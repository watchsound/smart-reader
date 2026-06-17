// src/main/brain/director/SessionRunner.js
//
// SessionRunner — orchestrates one Study Session as a stateful ReAct loop.
//
// Lifecycle:
//   runner.start({ userId, goal })  → { sessionId, traceId }
//   runner.userResult(sessionId, result) → resolves a pending surface tool
//   runner.cancel(sessionId)        → cancels a pending surface, unblocks loop
//   runner.waitForCompletion(sessionId) → Promise<finalState>
//
// The loop calls Director.step exactly once per iteration, dispatches by
// tool.kind (read / surface / soft-write / control), and persists state via
// the injected store.

const { v4: uuid } = require('uuid');
const tools = require('../spine/tools');
const studySessionConfig = require('./configs/studySession');

class SessionRunner {
  /**
   * @param {{ store: Object, director: Object, broadcast: Function }} opts
   *   store    — { saveActive, loadActive, clearActive, persistCompleted }
   *   director — Director module (must expose Director.step)
   *   broadcast — fn({ sessionId, kind, payload, iteration }) for real-time events
   */
  constructor({ store, director, broadcast }) {
    this.store = store;
    this.director = director;
    this.broadcast = broadcast;
    // Map<sessionId, { state, pendingSurfaceResolver, completionResolve, completionPromise }>
    this.active = new Map();
  }

  /**
   * Start a new session and kick off the run loop asynchronously.
   *
   * @returns {{ sessionId: string, traceId: string }}
   */
  async start({ userId, questId = null, goal }) {
    const state = {
      id: uuid(),
      userId,
      questId,
      goal,
      traceId: uuid(),
      status: 'active',
      iteration: 0,
      budget: studySessionConfig.budget || 12,
      trace: [],
      observations: [],
      softWrites: [],
      pendingSurface: null,
      startedAt: Date.now(),
      endedAt: null,
      errorReason: null,
      lastError: null,
      consecutiveErrors: 0,
    };

    await this.store.saveActive(state);

    let completionResolve;
    const completionPromise = new Promise(r => { completionResolve = r; });
    this.active.set(state.id, {
      state,
      pendingSurfaceResolver: null,
      completionResolve,
      completionPromise,
    });

    // Launch loop without awaiting — errors are caught in handleFatal
    this.runLoop(state.id).catch(err => this.handleFatal(state.id, err));

    return { sessionId: state.id, traceId: state.traceId };
  }

  /** Build the ctx object passed to tool invocations. */
  _ctx(state) {
    return {
      userId: state.userId,
      sessionId: state.id,
      traceId: state.traceId,
      awaitUserResult: (payload) => this._awaitUserResult(state.id, payload),
    };
  }

  /**
   * Called by a surface tool handler to suspend until the user responds.
   * Broadcasts 'openSurface' so the renderer can show the panel.
   */
  _awaitUserResult(sessionId, payload) {
    const entry = this.active.get(sessionId);
    return new Promise((resolve) => {
      entry.pendingSurfaceResolver = resolve;
      this.broadcast({ sessionId, kind: 'openSurface', payload });
    });
  }

  /**
   * Provide a user's response to the currently pending surface tool.
   * Returns false if no surface is pending.
   */
  userResult(sessionId, result) {
    const entry = this.active.get(sessionId);
    if (!entry?.pendingSurfaceResolver) return false;
    const resolve = entry.pendingSurfaceResolver;
    entry.pendingSurfaceResolver = null;
    resolve(result);
    return true;
  }

  /**
   * Cancel a session. If a surface is pending, resolves it with { cancelled: true }
   * so the loop can proceed to finish.
   */
  cancel(sessionId) {
    const entry = this.active.get(sessionId);
    if (!entry) return false;
    entry.state.userCancelled = true;
    if (entry.pendingSurfaceResolver) {
      const resolve = entry.pendingSurfaceResolver;
      entry.pendingSurfaceResolver = null;
      resolve({ cancelled: true });
    }
    return true;
  }

  /** Await session completion. Resolves with the final state object. */
  waitForCompletion(sessionId) {
    return this.active.get(sessionId).completionPromise;
  }

  // ---------------------------------------------------------------------------
  // Internal loop
  // ---------------------------------------------------------------------------

  async runLoop(sessionId) {
    const entry = this.active.get(sessionId);
    const state = entry.state;

    while (state.status === 'active') {
      // Bridge: studySession.promptTemplate is a function; Director.step wants systemPrompt string.
      const renderedPrompt = studySessionConfig.promptTemplate({
        goal: state.goal,
        iteration: state.iteration,
        budget: state.budget,
        observations: state.observations,
        softWrites: state.softWrites,
      });
      const stepConfig = {
        ...studySessionConfig,
        systemPrompt: renderedPrompt,
      };

      // --- Ask the Director for one decision ---
      let decision;
      try {
        decision = await this.director.step({
          config: stepConfig,
          state: {
            goal: state.goal,
            iteration: state.iteration,
            budget: state.budget,
            observations: state.observations,
            softWrites: state.softWrites,
          },
          traceId: state.traceId,
          userId: state.userId,
        });
        state.consecutiveErrors = 0;
      } catch (e) {
        state.lastError = e.message;
        state.consecutiveErrors++;
        this._appendTrace(state, {
          kind: 'error',
          iteration: state.iteration,
          payload: { message: e.message },
        });
        if (state.consecutiveErrors >= 3) {
          await this._finish(state, 'consecutive-errors');
          break;
        }
        continue;
      }

      // Record the thought (decision.reasoning — Phase 10a schema, NOT decision.reason)
      this._appendTrace(state, {
        kind: 'thought',
        iteration: state.iteration,
        payload: { reasoning: decision.reasoning },
      });
      this._appendTrace(state, {
        kind: 'tool',
        iteration: state.iteration,
        payload: { tool: decision.tool, args: decision.args },
      });

      // Look up the tool's kind
      const toolDesc = tools.descriptors().find(t => t.name === decision.tool);
      if (!toolDesc) {
        state.lastError = `unknown tool: ${decision.tool}`;
        state.consecutiveErrors++;
        this._appendTrace(state, {
          kind: 'error',
          iteration: state.iteration,
          payload: { message: state.lastError },
        });
        if (state.consecutiveErrors >= 3) {
          await this._finish(state, 'consecutive-errors');
          break;
        }
        continue;
      }

      // --- Dispatch by kind ---
      try {
        if (toolDesc.kind === 'control') {
          // endSession: args.reason is the TOOL argument (distinct from decision.reasoning)
          await this._finish(state, decision.args?.reason || 'control');
          break;
        }

        if (toolDesc.kind === 'read') {
          const result = await tools.invoke(decision.tool, decision.args || {}, this._ctx(state));
          const summary = JSON.stringify(result).slice(0, 200);
          state.observations.push({ tool: decision.tool, summary });
          this._appendTrace(state, {
            kind: 'observation',
            iteration: state.iteration,
            payload: { summary },
          });

        } else if (toolDesc.kind === 'surface') {
          // Record surface event BEFORE blocking on the user's response
          state.pendingSurface = { tool: decision.tool, args: decision.args };
          this._appendTrace(state, {
            kind: 'surface',
            iteration: state.iteration,
            payload: { tool: decision.tool, args: decision.args },
          });
          await this.store.saveActive(state);

          // tools.invoke calls the handler which calls ctx.awaitUserResult — suspends here
          const userResult = await tools.invoke(decision.tool, decision.args || {}, this._ctx(state));
          state.pendingSurface = null;
          const summary = JSON.stringify(userResult).slice(0, 200);
          state.observations.push({ tool: decision.tool, summary });
          this._appendTrace(state, {
            kind: 'observation',
            iteration: state.iteration,
            payload: { summary, userResult },
          });

        } else if (toolDesc.kind === 'soft-write') {
          const result = await tools.invoke(decision.tool, decision.args || {}, this._ctx(state));
          const sw = {
            id: uuid(),
            tool: decision.tool,
            args: decision.args,
            callId: result?.callId,
            executedAt: Date.now(),
            undone: false,
            handlerResult: result,
          };
          state.softWrites.push(sw);
          this._appendTrace(state, {
            kind: 'soft-write',
            iteration: state.iteration,
            payload: sw,
          });
        }

        state.iteration++;
        await this.store.saveActive(state);

        if (state.iteration >= state.budget) {
          await this._finish(state, 'budget-exhausted');
          break;
        }

      } catch (e) {
        state.lastError = e.message;
        state.consecutiveErrors++;
        this._appendTrace(state, {
          kind: 'error',
          iteration: state.iteration,
          payload: { message: e.message },
        });
        if (state.consecutiveErrors >= 3) {
          await this._finish(state, 'consecutive-errors');
          break;
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  _appendTrace(state, event) {
    const record = { ...event, ts: Date.now() };
    state.trace.push(record);
    this.broadcast({
      sessionId: state.id,
      kind: event.kind,
      payload: event.payload,
      iteration: event.iteration,
    });
  }

  async _finish(state, reason) {
    state.status = reason === 'consecutive-errors' ? 'errored' : 'completed';
    state.errorReason = reason === 'consecutive-errors' ? state.lastError : null;
    state.endedAt = Date.now();
    this._appendTrace(state, {
      kind: 'end',
      iteration: state.iteration,
      payload: { reason },
    });
    await this.store.persistCompleted(state);
    await this.store.clearActive();
    const entry = this.active.get(state.id);
    entry.completionResolve(state);
  }

  async handleFatal(sessionId, err) {
    const entry = this.active.get(sessionId);
    if (!entry) return;
    const state = entry.state;
    state.lastError = err.message;
    await this._finish(state, 'consecutive-errors');
  }
}

module.exports = SessionRunner;
