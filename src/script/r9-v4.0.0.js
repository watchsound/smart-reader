/**
 * TIBCO PageBus(TM) version 2.0.0
 * 
 * Copyright (c) 2006-2009, TIBCO Software Inc.
 * All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not 
 * use this file except in compliance with the License. You may obtain a copy 
 * of the License at http://www.apache.org/licenses/LICENSE-2.0 . Unless
 * required by applicable law or agreed to in writing, software distributed
 * under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR 
 * CONDITIONS OF ANY KIND, either express or implied. See the License for the 
 * specific language governing permissions and limitations under the License.
 *
 *
 * Includes code from the official reference implementation of the OpenAjax
 * Hub that is provided by OpenAjax Alliance. Specification is available at:
 *
 *  http://www.openajax.org/member/wiki/OpenAjax_Hub_Specification
 *
 * Copyright 2006-2009 OpenAjax Alliance
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not 
 * use this file except in compliance with the License. You may obtain a copy 
 * of the License at http://www.apache.org/licenses/LICENSE-2.0 . Unless
 * required by applicable law or agreed to in writing, software distributed
 * under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR 
 * CONDITIONS OF ANY KIND, either express or implied. See the License for the 
 * specific language governing permissions and limitations under the License.
 *
 ******************************************************************************/

// prevent re-definition of the OpenAjax object
if(!window["OpenAjax"]){
	OpenAjax = new function(){
		var t = true;
		var f = false;
		var g = window;
		var ooh = "org.openajax.hub.";

		var h = {};
		this.hub = h;
		h.implementer = "http://openajax.org";
		h.implVersion = "2.0";
		h.specVersion = "2.0";
		h.implExtraData = {};
		var libs = {};
		h.libraries = libs;

		h.registerLibrary = function(prefix, nsURL, version, extra){
			libs[prefix] = {
				prefix: prefix,
				namespaceURI: nsURL,
				version: version,
				extraData: extra 
			};
			this.publish(ooh+"registerLibrary", libs[prefix]);
		}
		h.unregisterLibrary = function(prefix){
			this.publish(ooh+"unregisterLibrary", libs[prefix]);
			delete libs[prefix];
		}

		h._subscriptions = {};// { c:{}, s:[] };
		h._cleanup = [];
		h._subIndex = 0;
		h._pubDepth = 0;

        h.cleanup= function( )			
		{
			 this._subscriptions = {};// { c:{}, s:[] };
		     this._cleanup = [];
		     this._subIndex = 0;
		     this._pubDepth = 0;
		}

        h._getData = function(timeline){
        	var tllist = this._subscriptions[timeline];
	        if( typeof tllist === 'undefined' ){
	        	tllist = { c:{}, s:[] };
	            this._subscriptions[timeline] = tllist;
	        } 
	        return tllist;
        }
		h.subscribe = function(name, callback, scope, subscriberData, filter, timeline)			
		{
			if(!scope){
				scope = window;
			}
			timeline = timeline || "";
			var tllist = this._getData(timeline);
			var handle = name + "." + this._subIndex;
			var sub = { scope: scope, cb: callback, fcb: filter, tl: timeline, data: subscriberData, sid: this._subIndex++, hdl: handle };
			var path = name.split(".");
	 		this._subscribe(tllist, path, 0, sub);
			return handle;
		}

		h.publish = function(name, message)		
		{
			var path = name.split(".");
			for(var key in this._subscriptions){
				this._pubDepth++;
				this._publish(this._getData(key), path, 0, name, message);
				this._pubDepth--;
				if((this._cleanup.length > 0) && (this._pubDepth == 0)) {
					for(var i = 0; i < this._cleanup.length; i++) 
						this.unsubscribe(this._cleanup[i].hdl);
					delete(this._cleanup);
					this._cleanup = [];
				}
			} 
		}

		h.unsubscribe = function(sub) 
		{
			var path = sub.split(".");
			var sid = path.pop(); 
			for(var key in this._subscriptions){
			    this._unsubscribe(this._getData(key), path, 0, sid);
			}
		}
		h.cleanupTimeline = function(timeline){
			try{
               delete this._subscriptions[timeline];
			}catch(e){
               console.log(e);
			} 
		}
		
		h._subscribe = function(tree, path, index, sub) 
		{
			var token = path[index];
			if(index == path.length) 	
				tree.s.push(sub);
			else { 
				if(typeof tree.c == "undefined")
					 tree.c = {};
				if(typeof tree.c[token] == "undefined") {
					tree.c[token] = { c: {}, s: [] }; 
					this._subscribe(tree.c[token], path, index + 1, sub);
				}
				else 
					this._subscribe( tree.c[token], path, index + 1, sub);
			}
		}

		h._publish = function(tree, path, index, name, msg, pid) {
			if(typeof tree != "undefined") {
				var node;
				if(index == path.length) {
					node = tree;
				} else {
					this._publish(tree.c[path[index]], path, index + 1, name, msg, pid);
					this._publish(tree.c["*"], path, index + 1, name, msg, pid);
					node = tree.c["**"];
				}
				if(typeof node != "undefined") {
					var callbacks = node.s;
					var max = callbacks.length;
					for(var i = 0; i < max; i++) {
						if(callbacks[i].cb) {
							var sc = callbacks[i].scope;
							var cb = callbacks[i].cb;
							var fcb = callbacks[i].fcb;
							var d = callbacks[i].data;
							if(typeof cb == "string"){
								// get a function object
								cb = sc[cb];
							}
							if(typeof fcb == "string"){
								// get a function object
								fcb = sc[fcb];
							}
							if((!fcb) || (fcb.call(sc, name, msg, d))) {
								cb.call(sc, name, msg, d, pid);
							}
						}
					}
				}
			}
		} 
		h._unsubscribe = function(tree, path, index, sid) {
			if(typeof tree != "undefined") {
				if(index < path.length) {
					var childNode = tree.c[path[index]];
					this._unsubscribe(childNode, path, index + 1, sid);
					if(childNode.s.length == 0) {
						for(var x in childNode.c) 
					 		return;		
						delete tree.c[path[index]];	
					}
					return;
				}
				else {
					var callbacks = tree.s;
					var max = callbacks.length;
					for(var i = 0; i < max; i++) 
						if(sid == callbacks[i].sid) {
							if(this._pubDepth > 0) {
								callbacks[i].cb = null;	
								this._cleanup.push(callbacks[i]);						
							}
							else
								callbacks.splice(i, 1);
							return; 	
						}
				}
			}
		}
	};
	// Register the OpenAjax Hub itself as a library.
	OpenAjax.hub.registerLibrary("OpenAjax", "http://openajax.org/hub", "1.0", {});
}

if(!window["PageBus"]) {
PageBus = new function() {
	var D = 0;  
	var Q = []; 
	var that = this;
	 
	
	this.version = "2.0.0";
	this._debug = function() {
		//hanning: debugger;
	};

    
	_badParm = function() { 
		throw new Error("OpenAjax.hub.Errors.BadParameters"); 
	}

	_valPub = function(name) {
		if((name == null) || (name.indexOf("*") != -1) || (name.indexOf("..") != -1) || 
			(name.charAt(0) == ".") || (name.charAt(name.length-1) == ".")) 
			_badParm();
	}
	
	_valSub = function(name) {
		var path = name.split(".");
		var len = path.length;
		for(var i = 0; i < len; i++) {
			if((path[i] == "") ||
			  ((path[i].indexOf("*") != -1) && (path[i] != "*") && (path[i] != "**")))
				_badParm();
			if((path[i] == "**") && (i < len - 1))
				_badParm();
		}
		return path;
	}
	
	_cacheIt = function( subData ) {
		return ( (subData) && (typeof subData == "object") && (subData["PageBus"]) && (subData.PageBus["cache"]) );
	};

	
	/////////////////////////////////
	
	_TopicMatcher = function() {
		this._items = {};
	};
	
	_TopicMatcher.prototype.store = function( topic, val ) {
		var path = topic.split(".");
		var len = path.length;
		_recurse = function(tree, index) {
			if (index == len)
				tree["."] = { topic: topic, value: val };
			else { 
				var token = path[index];
				if (!tree[token])
					tree[token] = {}; 
				_recurse(tree[token], index + 1);
			}
		};
		_recurse( this._items, 0 );
	};
	
	_TopicMatcher.prototype.match = function( topic, exactMatch ) {
		var path = topic.split(".");
		var len = path.length;
		var res = [];
		_recurse = function(tree, index) {
			if(!tree)
				return;
			var node;
			if (index == len)
				node = tree;
			else {	
				_recurse(tree[path[index]], index + 1);
				if(exactMatch)
					return;
				if(path[index] != "**") 
					_recurse(tree["*"], index + 1);
				node = tree["**"];
			}
			if ( (!node) || (!node["."]) )
				return;
			res.push(node["."]);
		};
		_recurse( this._items, 0 );
		return res;
	};
	
	_TopicMatcher.prototype.exists = function( topic, exactMatch ) {
		var path = topic.split(".");
		var len = path.length;
		var res = false;
		_recurse = function(tree, index) {
			if(!tree)
				return;
			var node;
			if (index == len)
				node = tree;
			else {	
				_recurse(tree[path[index]], index + 1);
				if(res || exactMatch)
					return;
				if(path[index] != "**") {
					_recurse(tree["*"], index + 1);
					if(res)
						return;
				}
				node = tree["**"];
			}
			if ( (!node) || (!node["."]) )
				return;
			res = true;
		};
		_recurse( this._items, 0 );
		return res;
	};
	
	_TopicMatcher.prototype.clear = function( topic ) {
		var path = topic.split(".");
		var len = path.length;
		_recurse = function(tree, index) {
			if(!tree)
				return;
			if (index == len) {
				if (tree["."])
					delete tree["."];
			}
			else {	
				_recurse(tree[path[index]], index + 1);
				for(var x in tree[path[index]]) {
					return;
				}
				delete tree[path[index]];
			}
		};
		_recurse( this._items, 0 );
	};
	
	_TopicMatcher.prototype.wildcardMatch = function( topic ) {
		var path = topic.split(".");
		var len = path.length;
		var res = [];
		_recurse = function( tree, index ) {
			var tok = path[index];
			var node;
			if( (!tree) || (index == len) )
				return;		
			if( tok == "**" ) {
				for( var n in tree ) {
					if( n != "." ) {
						node = tree[n];
						if( node["."] )
							res.push( node["."] );
						_recurse( node, index );
					}
				}
			}
			else if( tok == "*" ) {
				for( var n in tree ) {
					if( (n != ".") && (n != "**") ){
						node = tree[n];
						if( index == len - 1 ) {
							if( node["."] )			
								res.push( node["."] );
						}
						else
							_recurse( node, index + 1 );
					}
				}
			} 
			else {
				node = tree[tok];
				if(!node)
					return;
				if( index == len - 1 ) {
					if( node["."] )
						res.push( node["."] );
				}
				else 
					_recurse( node, index + 1 );
			}
		};
		_recurse( this._items, 0 );
		return res;
	};
	
	
	/////////////////////////////////
	
	this._refs = {};
	this._doCache = new _TopicMatcher();
	this._caches = new _TopicMatcher();
	
	_isCaching = function( topic ) {
		return that._doCache.exists( topic, false );
	};	
	
	_copy = function(obj) {
		var c;
		if( typeof(obj) == "object" ) {
			if(obj == null)
				return null;
			else if(obj.constructor == Array) {
				c = [];
				for(var i = 0; i < obj.length; i++)
					c[i] = _copy(obj[i]);
				return c;
			}
			else if(obj.constructor == Date) {
				c = new Date();
				c.setDate(obj.getDate());
				return c;
			}
			c = {};
			for(var p in obj) 
				c[p] = _copy(obj[p]);
			return c;
		}
		else {
			return obj;
		}
	};
		
	this._add = function( topic, subID ) {
		var dc;
		var dca = this._doCache.match( topic, true );
		if( dca.length > 0 )
			dc = dca[0].value;
		else {
			dc = { rc: 0 };
			this._doCache.store( topic, dc );
		}
		dc.rc++;
		this._refs[subID] = topic;
	};
	
	this._remove = function( subID ) {
		var topic = this._refs[subID];
		if( !topic )
			return;
		delete this._refs[subID];
		var dca = this._doCache.match( topic, true );
		if(dca.length == 0) 
			return;	
		dca[0].value.rc--;
		if(dca[0].value.rc == 0) {			
			this._doCache.clear(topic);
			var caches = this._caches.wildcardMatch(topic);
			for(var i = 0; i < caches.length; i++) {
				if( !(this._doCache.exists(caches[i].topic, false)) )
					this._caches.clear(caches[i].topic);
			}
		}
	};

	this.cleanup = function(){
         OpenAjax.hub.cleanup();
         this. D = 0;  
	     this. Q = []; 
         this._refs = {};
          
	     this._doCache = new _TopicMatcher();
	     this._caches = new _TopicMatcher();
	};
	this.cleanupTimeline = function(timeline){
	    OpenAjax.hub.cleanupTimeline(timeline);
	};

	this.subscribe = function( topic, scope, onData, subscriberData, timeline) {
		if(!subscriberData)
			subscriberData = null;
		 
		var sid = OpenAjax.hub.subscribe( topic, onData, scope, subscriberData, null, timeline);
		
		// Create caches after we subscribe
		
		if( _cacheIt( subscriberData ) ) {
			this._add( topic, sid );
			var vals = this.query( topic );
			for (var i = 0; i < vals.length; i++) {
				try {
					onData.call(scope ? scope : window, vals[i].topic, vals[i].value, subscriberData);
				}
				catch(e) {
					PageBus._debug();
				}
			}
		}
		return sid;
	}
	
	this.publish = function ( topic, data ) {	
		_valPub( topic );
		Q.push({ n: topic, m: data, d: (D + 1) });
		
		
		if( _isCaching( topic ) ) {
			
			// Cache a copy of the message before we deliver the message
			
			try {	
				this._caches.store( topic, data );
			} catch(e) {
				console.log(err);
				_badParm();
			}
			
		}
		
		if(D == 0) {
			while(Q.length > 0) {
				var qitem = Q.shift();
				var path = qitem.n.split(".");
				try {
					D = qitem.d;
					OpenAjax.hub.publish(qitem.n, qitem.m);
					D = 0;
				}
				catch(err) {
					D = 0;
					console.log(err);
					//hanning throw(err);
				}
			}
		}
	}
	
	this.unsubscribe = function(sub) {
		try {
			this._remove(sub); 
			OpenAjax.hub.unsubscribe(sub);
		}
		catch(err) {
			console.log(err);
			_badParm();
		}
	}
	
	this.store = function( topic, data ) {
		if( !_isCaching( topic ) )
			throw new Error( "PageBus.cache.NoCache" );
		this.publish( topic, data );
	};
	
	this.query = function( topic ) {
		try {
			_valSub( topic ); 
			return this._caches.wildcardMatch( topic );
		} catch(e) {
			console.log(err);
			_badParm();
		}
	};
};

OpenAjax.hub.registerLibrary("PageBus", "http://tibco.com/PageBus", "1.2.0", {});
  
}

;
(function () {

    Kinetic.R9Balloon = function (config) {
        this.___init(config);
    };

    Kinetic.R9Balloon.prototype = {
        ___init: function (config) {

            Kinetic.Shape.call(this, config);
            this.className = 'R9Balloon';
            this.cloudArray = [];
            if (this.cloud())
                this.cloudArray = Kinetic.Util.parsePathData(r9_cloud);

            this.sceneFunc(this._sceneFunc);
        },
        _sceneFunc: function (context) {
            var cornerRadius = this.getCornerRadius(),
                x = this.x(),
                y = this.y(),
                width = this.getWidth(),
                height = this.getHeight(),
                p1x = this.p1X(),
                p1y = this.p1Y(),
                p2x = this.p2X(),
                p2y = this.p2Y(),
                arrowx = this.arrowX(),
                arrowy = this.arrowY(),
                rwidth = this.rwd(),
                rheight = this.rht(),
                btype = this.btype(),
                borderonly = this.borderonly(),
                duration = this.duration(),
                progressvalue = this.progressvalue();

            var ratio = 1;
            if (this.cloud()) {
                var cbw =   rwidth;
                var cbh =   rheight;
                var scaleX = cbw / 250.0, scaleY = cbh / 100.0;
                context.scale(scaleX, scaleY);
                Kinetic.Util.drawPathByData(this, context, this.cloudArray, false);
                context.scale(1 / scaleX, 1 / scaleY);
            } else if (this.oval()) {
                var    PI2 = (Math.PI * 2) - 0.0001, ratio = rheight / rwidth;
                context.save();
                context.translate( rwidth/2, rheight/2);
                if (ratio !== 1) {
                    context.scale(1, ratio);
                }
                context.beginPath();  
                context.arc(0, 0, rwidth/2,  0, PI2, false); 
                context.closePath();
                if (borderonly)
                    context.strokeShape(this);
                else
                    context.fillShape(this);
                if (ratio !== 1) {
                    context.scale(1, 1 /ratio);
                }  
                context.translate(- rwidth/2, -rheight/2);
                context.restore();
            } else {
                context.beginPath();
                ratio = rheight / rwidth;
                if (!cornerRadius) {
                    context.rect(0, 0, rwidth, rheight);
                    context.closePath();
                } else {
                    r9_drawRounded.call(this, context, 0, 0, rwidth, rheight, cornerRadius);
                }
                if (borderonly)
                    context.strokeShape(this);
                else
                    context.fillShape(this);
            }


            var ex = arrowx, ey = arrowy;
            if (this.bubble() > 0) {
                var cx = (p1x + p2x) / 2, cy = (p1y + p2y) / 2;
                var rxc = Math.max(Math.abs(p2x - p1x) / 12, 2), ryc = Math.max(Math.abs(cy - ey) / 12, 2);
                var ccx = cx, ccy = cy;
                var lenx = Math.max(Math.abs(cx - ex), 2);
                var leny = Math.max(Math.abs(cy - ey), 2);

                if (duration > 0) {
                    ccx = Math.abs(p2x - p1x) * progressvalue;
                }
                PI2 = (Math.PI * 2) - 0.0001;
                ratio = rheight / rwidth;
                
                for (var i = 1; i <= 5; i++) {
                    var rx = rxc * i,
                        ry = ryc * i;
                    if (rx > ccx) continue;
                    context.save();
                    
                    var ix = ex < cx ? i : -i;
                    var iy = ey < cy ? i : -i;
                    var cxx = ex  + ix * lenx / 5;
                    var cyy =  (ey  + iy * leny / 5)  ;
                    context.translate(cxx, cyy);
                  
                    if (rx !== ry) {
                        context.scale(1, ratio);
                    } 
                    context.beginPath(); 
                    context.arc( 0, 0, rx, 0, PI2, false); 
                    context.closePath();
                    if (borderonly)
                        context.strokeShape(this);
                    else
                        context.fillShape(this);
                    if (rx !== ry) {
                        context.scale(1, 1/ratio);
                    } 
                    
                    context.translate(-cxx, -cyy);
                    context.restore();
                }
            } else {
                if (duration > 0) {
                    ex = ex + (p1x - ex) * progressvalue;
                    ey = ey + (p1y - ey) * progressvalue;
                }
                context.beginPath();
                context.moveTo(p1x  , p1y  );
                context.lineTo(p2x  , p2y );
                context.lineTo(ex  , ey  );
                context.lineTo(p1x  , p1y  );
                context.closePath();
                if (borderonly )
                    context.strokeShape(this);
                else
                    context.fillShape(this);
            }


            this.drawSelectionMarker(context);

        }
    };
    Kinetic.Util.extend(Kinetic.R9Balloon, Kinetic.Shape);


    Kinetic.Factory.addGetterSetter(Kinetic.R9Balloon, 'p1X', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Balloon, 'p1Y', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Balloon, 'p2X', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Balloon, 'p2Y', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Balloon, 'arrowX', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Balloon, 'arrowY', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Balloon, 'rwd', 1);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Balloon, 'rht', 1);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Balloon, 'btype', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Balloon, 'cornerRadius', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Balloon, 'bubble', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Balloon, 'borderonly', false);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Balloon, 'duration', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Balloon, 'oval', false);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Balloon, 'cloud', false);
    Kinetic.Factory.addComponentsGetterSetter(Kinetic.R9Balloon, 'radius', ['x', 'y']);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Balloon, 'radiusX', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Balloon, 'radiusY', 0);

    Kinetic.Collection.mapMethods(Kinetic.R9Balloon);
})();
;

(function () {

    Kinetic.R9Checkbox = function (config) {
        this.___init(config);
    };

    Kinetic.R9Checkbox.prototype = {
        ___init: function (config) {

            Kinetic.Shape.call(this, config);
            this.className = 'R9Checkbox';
            this.sceneFunc(this._sceneFunc);
            this.hitFunc(this._hitFunc);
        },
        _hitFunc: function (context) {
            var width = this.getWidth(),
                height = this.getHeight(), x = this.startX(), y = this.startY();

            context.beginPath();
            context.rect(x, y, width, height);
            context.closePath();
            context.fillStrokeShape(this);
        },

        _sceneFunc: function (context) {
            var startX = this.startX(),
                startY = this.startY(),
                endX = this.startX() + this.width(),
                endY = this.startY() + this.height(),
                checked = this.checked(),
                markcolor = this.markcolor(),
                boxstype = this.boxstype();


            if (boxstype == 0) {

                context.beginPath()
                context.moveTo(startX, startY);
                context.lineTo(endX, endY);
                context.moveTo(startX, endY);
                context.lineTo(endX, startY);
                context._context.strokeStyle = markcolor;
                context.stroke(this);

                context.beginPath();
                context.moveTo(startX, startY);
                context.lineTo(startX, endY);
                context.lineTo(endX, endY);
                context.lineTo(endX, startY);
                context.lineTo(startX, startY);
                context.fillStrokeShape(this);

            }
            else if (boxstype == 1) {
                var PIx2 = (Math.PI * 2) - 0.0001;

                context._context.fillStyle = markcolor;
                var rx = (endX - startX) / 2;
                ry = (endY - startY) / 2;

                if (checked != 0) {
                    context._context.fillStyle = markcolor;
                    rx = rx - 4;
                    ry = ry - 4;
                    context.beginPath();
                    context.save();
                    if (rx !== ry) {
                        context.scale(1, ry / rx);
                    }
                    context.arc(0, 0, rx, 0, PIx2, false);
                    context.restore();
                    context.closePath();
                    context.fill(this);

                    rx = rx + 4;
                    ry = ry + 4;
                }

                context.beginPath();
                context.save();
                if (rx !== ry) {
                    context.scale(1, ry / rx);
                }
                context.arc(0, 0, rx, 0, PIx2, false);
                context.restore();
                context.closePath();
                context.fillStrokeShape(this);

            } else {

                context.save();
                var iconName = checked == 0 ? this.uncheckimg() : this.checkimg();
                var imge = r9 && r9.getCacheImageByName(iconName);
                if (imge) {
                    var params = [imge, this.startX(), this.startY(), this.width(), this.height()];
                    context.drawImage.apply(context, params);
                }

                context.restore();

            }

        } 
    };
    Kinetic.Util.extend(Kinetic.R9Checkbox, Kinetic.Shape);


    Kinetic.Factory.addGetterSetter(Kinetic.R9Checkbox, 'startX', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Checkbox, 'startY', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Checkbox, 'strokeRed', '1');
    Kinetic.Factory.addGetterSetter(Kinetic.R9Checkbox, 'strokeGreen', '1');
    Kinetic.Factory.addGetterSetter(Kinetic.R9Checkbox, 'strokeBlue', '1');
    Kinetic.Factory.addGetterSetter(Kinetic.R9Checkbox, 'strokeWidth', 1);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Checkbox, 'boxstype', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Checkbox, 'markcolor', 'black');
    Kinetic.Factory.addGetterSetter(Kinetic.R9Checkbox, 'uncheckimg', 'r9checkbox_u.png');
    Kinetic.Factory.addGetterSetter(Kinetic.R9Checkbox, 'checkimg', 'r9checkbox_s.png');

    Kinetic.Collection.mapMethods(Kinetic.R9Checkbox);
})();

;(function () {

    Kinetic.R9Dialog = function (config) {
        this.___init(config);
    };

    Kinetic.R9Dialog.prototype = {
        ___init: function (config) {
            Kinetic.Shape.call(this, config);
            this.className = 'R9Dialog';
            this.sceneFunc(this._sceneFunc);
        },
        _sceneFunc: function (context) {
            var startX = 0,
                startY = 0,
                title = this.title(),
                message1 = this.message1(),
                message2 = this.message2(),
                message3 = this.message3(),
                fontSize = this.fontSize();

            var dx = startX;
            var dy = startY;
            var dw = 0;
            var dh = 0;
            var height = 40;
            context._context.font = fontSize + 'pt Calibri';
            context._context.textAlign = 'center';

            var metrics = context._context.measureText(title);
            var width = metrics.width;
            dh += height;
            if (dw < width)
                dw = width;
            metrics = context._context.measureText(message1);
            width = metrics.width;
            dh += height;
            if (dw < width)
                dw = width;
            metrics = context._context.measureText(message2);
            width = metrics.width;
            dh += height;
            if (dw < width)
                dw = width;
            metrics = context._context.measureText(message3);
            width = metrics.width;
            dh += height;
            if (dw < width)
                dw = width;

            context.globalAlpha = 0.5;
            context.beginPath();
            context.rect(dx - 20 - dw / 2, dy - 20, dw + 40, dh + 40);
            context._context.fillStyle = 'yellow';
            context.fill();
            context.lineWidth = 7;
            context._context.strokeStyle = 'black';
            context._context.fillStyle = 'black';

            context.fillText(title, startX, startY);
            context.moveTo(dx - 20 - dw / 2, startY + height / 2);
            context.lineTo(dx - 20 - dw / 2 + dw + 40, startY + height / 2);
            startY = startY + height + height / 2;
            context.fillText(message1, startX, startY);
            startY = startY + height;
            context.fillText(message2, startX, startY);
            startY = startY + height;
            context.fillText(message3, startX, startY);

            context.fillStrokeShape(this);

            this.drawSelectionMarker(context);
        }
    };
    Kinetic.Util.extend(Kinetic.R9Dialog, Kinetic.Shape);


    Kinetic.Factory.addGetterSetter(Kinetic.R9Dialog, 'x', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Dialog, 'y', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Dialog, 'stroke', 'black');
    Kinetic.Factory.addGetterSetter(Kinetic.R9Dialog, 'strokeWidth', 1);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Dialog, 'fontSize', 18);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Dialog, 'title', '');
    Kinetic.Factory.addGetterSetter(Kinetic.R9Dialog, 'message1', '');
    Kinetic.Factory.addGetterSetter(Kinetic.R9Dialog, 'message2', '');
    Kinetic.Factory.addGetterSetter(Kinetic.R9Dialog, 'message3', '');



    Kinetic.Collection.mapMethods(Kinetic.R9Dialog);
})();
;
(function () {
    // the 0.0001 offset fixes a bug in Chrome 27
    var PIx2 = (Math.PI * 2) - 0.0001,
        R9ELLIPSE = 'R9Ellipse';

    Kinetic.R9Ellipse = function (config) {
        this.___init(config);
    };

    Kinetic.R9Ellipse.prototype = {
        ___init: function (config) {
            // call super constructor
            Kinetic.Shape.call(this, config);
            this.className = R9ELLIPSE;
            this.sceneFunc(this._sceneFunc);
        },
        _sceneFunc: function (context) {
            var rx = this.getRadiusX(),
                ry = this.getRadiusY(),
                duration = this.duration(),
                progressvalue = this.progressvalue(),
                start = this.start(),
                end = this.end(),
                animationColorAll = this.animationColorAll(),
                animationBallColor = this.animationBallColor(),
                useAnimationBall = this.useAnimationBall(),
                hideScratch = this.hideScratch(),
                antiClockwise = this.antiClockwise() == 0 ? false : true;


            if (!hideScratch) {
                context.beginPath();
                context.save();
                if (rx !== ry) {
                    context.scale(1, ry / rx);
                }
                context.arc(0, 0, rx, 0, PIx2, false);
                context.restore();
                context.closePath();
                context.fillStrokeShape(this);
            }

            if (duration > 0) {
                start = start * 2 * Math.PI / 360;
                end = end * 2 * Math.PI / 360;
                end = start + (end - start) * progressvalue;
                context.beginPath();
                context.save();
                if (animationBallColor) {
                    context.setAttr('fillStyle', animationBallColor);
                    context.setAttr('strokeStyle', animationBallColor);
                }
                if (rx !== ry) {
                    context.scale(1, ry / rx);
                }
                context.arc(0, 0, rx, start, end, antiClockwise);
                context.restore();
                if (animationColorAll)
                    context.strokeShape(this);

                var endX = rx * Math.cos(end);
                var endY = ry * Math.sin(end);
                if (useAnimationBall) {
                    context.beginPath();
                    if (animationBallColor) {
                        context.setAttr('fillStyle', animationBallColor);
                        context.setAttr('strokeStyle', animationBallColor);
                    }
                    context.arc(endX, endY, 4, 0, 2 * Math.PI, antiClockwise);
                    context.fill(this);
                }
            }


            this.drawCorrectMarker(context);

            this.drawSelectionMarker(context);
        },
        // implements Shape.prototype.getWidth()
        getWidth: function () {
            return this.getRadiusX() * 2;
        },
        // implements Shape.prototype.getHeight()
        getHeight: function () {
            return this.getRadiusY() * 2;
        },
        drawSelectionMarker: function(context){
       	   if(  this.checked() ){ 
                context.setAttr('strokeStyle',  'rgba(255,0,0,1)');
                context.beginPath(); 
                context.rect( -this.getWidth() * this.scaleX() / 2, -this.getHeight() * this.scaleY() / 2, this.getWidth(), this.getHeight());
                context.closePath();
                context.stroke(this); 
            } 
        },
        // implements Shape.prototype.setWidth()
        setWidth: function (width) {
            Kinetic.Node.prototype.setWidth.call(this, width);
            this.setRadius({
                x: width / 2
            });
        },
        renderBounds: function () {
            var cp = this.getParent(), cx1 = this.getX() - this.getWidth() * this.scaleX() / 2,
                cy1 = this.getY() - this.getHeight() * this.scaleY() / 2;
            if (cp && (typeof cp.nodeType != 'undefined') && (cp.nodeType == 'Group')) {
                cx1 += cp.getX(); cy1 += cp.getY();
            }
            return { 'x': cx1, 'y': cy1, 'w': Math.abs(this.getWidth() * this.scaleX()), 'h': Math.abs(this.getHeight() * this.scaleY()) };
        },
        toPathString: function () {
            var b = this.renderBounds();
            return "M " + b.x + " " + (b.y + b.h / 2) + " " + " A " + b.w / 2 + " " + b.h / 2 +
                ", 0, 0 1, " + (b.x + b.w) + " " + (b.y + b.h / 2) +
                " A " + b.w / 2 + " " + b.h / 2 + ", 0,0, 1, " + b.x + " " + (b.y + b.h / 2);
        },
        // implements Shape.prototype.setHeight()
        setHeight: function (height) {
            Kinetic.Node.prototype.setHeight.call(this, height);
            this.setRadius({
                y: height / 2
            });
        },
        getBounds: function(){
        	return {
        		x: this.getX() - this.getWidth()/2,
        		y: this.getY() - this.getHeight()/2,
        		width: this.getWidth(),
                height: this.getHeight()
        	};
        },
        getCenter: function(locType){ 
        	switch(locType){
	        	case 'top':  return { 	x: this.getX() , y: this.getY() - this.getHeight()/2 }; 
	        	case 'bottom':  return { 	x: this.getX()  , y: this.getY() + this.getHeight()/2  }; 
	        	case 'left':  return { 	x: this.getX() - this.getWidth()/2  , y: this.getY()   }; 
	        	case 'right':  return { 	x: this.getX() + this.getWidth()/2 , y: this.getY()    };  
        	} 
        	return {
        		x: this. getX()  ,
        		y: this.getY()   
        	};  
        },
    };

    Kinetic.Util.extend(Kinetic.R9Ellipse, Kinetic.Shape);

    // add getters setters
    Kinetic.Factory.addComponentsGetterSetter(Kinetic.R9Ellipse, 'radius', ['x', 'y']);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Ellipse, 'radiusX', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Ellipse, 'radiusY', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Ellipse, 'duration', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Ellipse, 'animationColorAll', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Ellipse, 'animationBallColor', null);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Ellipse, 'useAnimationBall', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Ellipse, 'draghooktargets', []);

    Kinetic.Factory.addGetterSetter(Kinetic.R9Ellipse, 'hideScratch', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Ellipse, 'start', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Ellipse, 'end', 360);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Ellipse, 'antiClockwise', 0);


    Kinetic.R9Ellipse.prototype.setX = function (x) {
        Kinetic.Node.prototype.setX.call(this, x);
        this.adjustdraghooks();
    }
    Kinetic.R9Ellipse.prototype.setY = function (y) {
        Kinetic.Node.prototype.setY.call(this, y);
        this.adjustdraghooks();
    }
    Kinetic.R9Ellipse.prototype.adjustdraghooks = function () {
        var draghooktargets = this.draghooktargets(), rx = this.getRadiusX(),
            ry = this.getRadiusY(); rx = 0; ry = 0;
        if (draghooktargets.length > 0) {
            var adjx = (this.parent && this.parent.nodeType === "Group") ? this.parent.x() : 0;
            var adjy = (this.parent && this.parent.nodeType === "Group") ? this.parent.y() : 0;
            for (var io = 0; io < draghooktargets.length; io++) {
                if (draghooktargets[io].type == 0) {
                    draghooktargets[io].node.setTargetStartX(Number(adjx + this.x() + rx / 2));
                    draghooktargets[io].node.setTargetStartY(Number(adjy + this.y() + ry / 2));
                } else if (draghooktargets[io].type == 1) {
                    draghooktargets[io].node.setTargetStartX(Number(adjx + this.x() + rx / 2));
                    draghooktargets[io].node.setTargetStartY(Number(adjy + this.y() + ry / 2));
                } else if (draghooktargets[io].type == 2) {
                    draghooktargets[io].node.setTargetEndX(Number(adjx + this.x() + rx / 2));
                    draghooktargets[io].node.setTargetEndY(Number(adjy + this.y() + ry / 2));
                }
            }
        }
    }
    Kinetic.R9Ellipse.prototype.calculateOtargetsPos = function () {
        var rx = this.getRadiusX(), ry = this.getRadiusY(), duration = this.duration(),
            progressvalue = this.progressvalue(), start = this.start(), end = this.end(),
            antiClockwise = this.antiClockwise() == 0 ? false : true;
        if (duration <= 0) { return; }
        start = start * 2 * Math.PI / 360;
        end = end * 2 * Math.PI / 360;
        end = start + (end - start) * progressvalue;
        var endX = rx * Math.cos(end);
        var endY = ry * Math.sin(end);
        this.curx(endX);
        this.cury(endY);
    };

    Kinetic.Collection.mapMethods(Kinetic.R9Ellipse);



})();

;
(function () {

    Kinetic.R9Highlighter = function (config) {
        this.___init(config);
    };

    Kinetic.R9Highlighter.prototype = {
        ___init: function (config) {

            Kinetic.Shape.call(this, config);
            this.className = 'R9Highlighter';
            this.sceneFunc(this._sceneFunc);
            this.hitFunc(this._hitFunc);
        },
        _hitFunc: function (context) {
            var width = this.getWidth(), height = this.getHeight();
            context.beginPath();
            context.rect(0, 0, width, height);
            context.closePath();
            context.fillStrokeShape(this);
        },

        _sceneFunc: function (context) {
            var x = 0,
                y = 0,
                width = this.getWidth(),
                height = this.getHeight(),
                duration = this.getDuration(),
                progressvalue = this.progressvalue(),
                line = this.getLine();

            if (duration > 0) {
                width = width * progressvalue * 1.0;
            }

            if (line == 0) {
                context.beginPath();
                context.moveTo(x, y);
                context.lineTo(x + width, y);
                context.lineTo(x + width, y + height);
                context.lineTo(x, y + height);
                context.lineTo(x, y);
                context.closePath();
                context.fillShape(this);
            } else if (line == 1) {
                context.beginPath();
                context.moveTo(x, y + height);
                context.lineTo(x + width, y + height);
                context.closePath();
                context.strokeShape(this);
            } else if (line == 2) {
                context.beginPath();
                var cornerRadius = width < height ? width / 2 : height / 2;
                r9_drawRounded.call(this,context, 0, 0, width, height, cornerRadius);
                context.strokeShape(this);
            } else if (line == 3) {
                context.beginPath();
                context.moveTo(x, y + height / 2);
                context.lineTo(x + width, y + height / 2);
                context.closePath();
                context.strokeShape(this);
            } else if (line == 4) {
                context.beginPath();
                context.moveTo(x, y + height);
                context.lineTo(x + width, y);
                context.closePath();
                context.strokeShape(this);
            } else if (line == 5) {
                context.beginPath();
                context.moveTo(x, y);
                context.lineTo(x + width, y + height);
                context.moveTo(x, y + height);
                context.lineTo(x + width, y);
                context.closePath();
                context.strokeShape(this);
            }

            this.drawSelectionMarker(context);

        }
    };
    Kinetic.Util.extend(Kinetic.R9Highlighter, Kinetic.Shape);

    Kinetic.Factory.addGetterSetter(Kinetic.R9Highlighter, 'duration', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Highlighter, 'line', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Highlighter, 'aorder', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Highlighter, 'showchecked', 0);

    Kinetic.Collection.mapMethods(Kinetic.R9Highlighter);
})();
;(function () {

    Kinetic.R9Polygon = function (config) {
        this.___init(config);
    };

    Kinetic.R9Polygon.prototype = {
        ___init: function (config) {
            // call super constructor
            Kinetic.Shape.call(this, config);
            this.className = 'R9Polygon';

            this.on('pointsChange.kinetic tensionChange.kinetic closedChange.kinetic', function () {
                this._clearCache('tensionPoints');
            });

            this.sceneFunc(this._sceneFunc);
        },
        _sceneFunc: function (context) {
            var points = this.getPoints(),
                length = points.length,
                closed = this.getClosed(),
                duration = this.duration(),
                progressvalue = this.progressvalue(),
                lastPoint = this.lastPoint(),
                strokeWidth = this.strokeWidth(),
                useArrow = this.useArrow(),
                animationColorAll = this.animationColorAll(),
                animationBallColor = this.animationBallColor(),
                useAnimationBall = this.useAnimationBall(),
                hideScratch = this.hideScratch(),
                tp, len, n, endX = -1, endY = -1, curdata = [];
            if (length == 0) {
                points = this.getDataFromProps();
                length = points.length;
            }

            if (duration > 0) {
                if (progressvalue == 0)
                    return;
                var results = r9_drawLinePath.call(this, points, length, progressvalue, duration, lastPoint);
                this.lastPoint(results.lastPoint);
                if (typeof results.curdata == 'undefined')
                    return;
                tp = results.tp; len = results.len; n = results.n; endX = results.endX;
                endY = results.endY; curdata = results.curdata;
                if (!useAnimationBall)
                    points = curdata;
            }
            if (progressvalue >= duration && length >= 4 && useArrow) {
                this.drawArrowHead(context, points[length - 4], points[length - 3],
                    points[length - 2], points[length - 1]);
            }

            if (!hideScratch) {
                context.beginPath();
                context.moveTo(points[0], points[1]);
                for (n = 2; n < length; n += 2) {
                    context.lineTo(points[n], points[n + 1]);
                }
                // closed e.g. polygons and blobs
                if (closed) {
                    context.closePath();
                    context.fillStrokeShape(this);
                }
                // open e.g. lines and splines
                else {
                    context.strokeShape(this);
                }
                if (length >= 4 && useArrow) {
                    this.drawArrowHead(context, points[length - 4], points[length - 3],
                        points[length - 2], points[length - 1]);
                }
            }
            if (animationColorAll && curdata.length > 1) {
                points = curdata;
                this.fillEnabled(false);
                context.beginPath();
                if (animationBallColor) {
                    context.setAttr('fillStyle', animationBallColor);
                    context.setAttr('strokeStyle', animationBallColor);
                }

                context.beginPath();
                context.moveTo(points[0], points[1]);

                for (n = 2; n < length; n += 2) {
                    context.lineTo(points[n], points[n + 1]);
                }
            }

            if (animationColorAll)
                context.stroke(this);
            if (useAnimationBall && endX >= 0 && endY >= 0) {
                context.beginPath();
                if (animationBallColor) {
                    context.setAttr('fillStyle', animationBallColor);
                    context.setAttr('strokeStyle', animationBallColor);
                }
                context.arc(endX, endY, 4, 0, 2 * Math.PI, false);
                context.fill(this);
            }

            this.drawCorrectMarker(context);

            if (!!hideScratch) {
                this.drawSelectionMarker(context);
            }

        }

    };
    Kinetic.Util.extend(Kinetic.R9Polygon, Kinetic.Shape);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Polygon, 'useArrow', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Polygon, 'closed', false);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Polygon, 'duration', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Polygon, 'x1', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Polygon, 'y1', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Polygon, 'x2', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Polygon, 'y2', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Polygon, 'x3', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Polygon, 'y3', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Polygon, 'x4', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Polygon, 'y4', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Polygon, 'x5', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Polygon, 'y5', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Polygon, 'x6', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Polygon, 'y6', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Polygon, 'x7', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Polygon, 'y7', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Polygon, 'x8', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Polygon, 'y8', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Polygon, 'x9', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Polygon, 'y9', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Polygon, 'count', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Polygon, 'points', []);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Polygon, 'animationColorAll', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Polygon, 'useAnimationBall', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Polygon, 'lastPoint', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Polygon, 'animationBallColor', null);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Polygon, 'hideScratch', 0);


    Kinetic.R9Polygon.prototype.getDataFromProps = function () {
        var data = [], count = this.count();
        if (count == 0) return data;
        if (count > 0) { data.push(this.x1()); data.push(this.y1()); }
        if (count > 1) { data.push(this.x2()); data.push(this.y2()); }
        if (count > 2) { data.push(this.x3()); data.push(this.y3()); }
        if (count > 3) { data.push(this.x4()); data.push(this.y4()); }
        if (count > 4) { data.push(this.x5()); data.push(this.y5()); }
        if (count > 5) { data.push(this.x6()); data.push(this.y6()); }
        if (count > 6) { data.push(this.x7()); data.push(this.y7()); }
        if (count > 7) { data.push(this.x8()); data.push(this.y8()); }
        if (count > 8) { data.push(this.x9()); data.push(this.y9()); }
        return data;
    };

    Kinetic.R9Polygon.prototype.calculateOtargetsPos = function () {
        var points = this.getPoints(), length = points.length, duration = this.duration(), progressvalue = this.progressvalue(),
            lastPoint = this.lastPoint(), animationColorAll = this.animationColorAll(),
            tp, len, n, endX = -1, endY = -1, curdata = [];
        if (duration <= 0 || duration == progressvalue) return;
        var results = r9_drawLinePath.call(this, points, length, progressvalue, duration, lastPoint);
        if ((typeof results.curdata == 'undefined') || (isNaN(results.endX))) return;
        this.curx(results.endX);
        this.cury(results.endY);
    };

    Kinetic.R9Polygon.prototype.drawArrowHead = function (context, startX, startY, endX, endY) {
        var sw = this.getStrokeWidth() || 1;
        var start = new Point(startX, startY);
        var end = new Point(endX, endY);
        var angle = start.calcAngle( end);
        var newStart = start;
        var newEnd = end;
        var arrowSize = sw * 3; if (arrowSize < 10) arrowSize = 10;

        newEnd = end.calcPoint( angle, arrowSize - 5);
        this.fillEnabled(true);
        context.beginPath();


        var ap1 = newEnd.calcPoint(  angle - 45 - 90, arrowSize);
        context.moveTo(newEnd.x, newEnd.y);
        context.lineTo(ap1.x, ap1.y);
        var ap2 = newEnd.calcPoint( angle + 45 + 90, arrowSize);
        context.lineTo(ap2.x, ap2.y);
        context.lineTo(newEnd.x, newEnd.y);
        context.closePath();
        context.fillStrokeShape(this);

    };


    Kinetic.Collection.mapMethods(Kinetic.R9Polygon);
})();

(function () {

    Kinetic.GeomPolyFill = function (config) {
        this.___init(config);
    };

    Kinetic.GeomPolyFill.prototype = {
        ___init: function (config) {
            // call super constructor
            Kinetic.Shape.call(this, config);
            this.className = 'GeomPolyFill';
            this.cachedPoses = []; 
            this.geomPoints = this.geomPoints || [];
            this.dataArray = [];
            this.sceneFunc(this._sceneFunc);
        },
        _sceneFunc: function (context) {
        	this.createShapes();
        	var pvalue = this.progressvalue();
        	if( pvalue >=0 && pvalue < 1)
        	    Kinetic.Util.drawPathByProgress(this, context, this.dataArray, pvalue, this.forceClose, this.strokeOnly);
        	else
        		Kinetic.Util.drawPathByData(this, context, this.dataArray, this.forceClose);
        }

    };
    Kinetic.Util.extend(Kinetic.GeomPolyFill, Kinetic.Path);
    Kinetic.Factory.addGetterSetter(Kinetic.GeomPolyFill, 'geomPoints', []);
   
    Kinetic.GeomPolyFill.prototype.setupVertices = function (vertices) {
    	 this.geomPoints = vertices;
    	 this.createShapes();
    }; 
    Kinetic.GeomPolyFill.prototype.createShapes = function (createShapes) {
    	 var cp = this.cachedPoses, dirty = cp.length == 0, gp = this.geomPoints, count = gp.length, v;
         if( count == 0) return;
         if( dirty ){
             for( var pos in gp){
            	 v = gp[pos].position();
                 cp.push( {x: v.x, y: v.y} );
             }
         }
         else {
             for(var i = 0; i < count; i++){
            	 v = gp[i].position();
                 if(  cp[i].x != v.x || cp[i].y != v.y ){
                     cp[i] = {x: v.x, y: v.y};
                     dirty = true;
                 }
             }
         }
         if( dirty ){ 
        	 var newdata = "";
             for (var i = 0; i < count; i++) {
            	 if( i == 0 ) newdata += " M "; else newdata +=" L "
                 newdata += cp[i].x + " " + cp[i].y;
             } 
             this.dataArray = Kinetic.Util.parsePathData(newdata + "z");
             this.closed = true;
         } 
    }; 
    Kinetic.Collection.mapMethods(Kinetic.GeomPolyFill);
})();
;
(function () {

    Kinetic.R9Menu = function (config) {
        this.___init(config);
    };

    Kinetic.R9Menu.prototype = {
        ___init: function (config) {
            var that = this;
            // call super constructor
            Kinetic.Shape.call(this, config);
            this.className = 'R9Menu';
            // this.add(new Kinetic.Tag({
            //    fill: '#bbb',
            //    stroke: '#333',
            //     shadowColor: 'black',
            //     shadowBlur: 10,
            //      shadowOffset: [10, 10],
            //      shadowOpacity: 0.2,
            //      lineJoin: 'round', 
            //     cornerRadius: 5
            // })); 
            this.sceneFunc(this._sceneFunc);
            this.hitFunc(this._hitFunc);
        },
        _hitFunc: function (context) {
            var width = this.getWidth(), height = this.getHeight();
            context.beginPath();
            context.rect(0, 0, width, height);
            context.closePath();
            context.fillStrokeShape(this);
        },
        _sceneFunc: function (context) {
            if (this.hide() == 1) return;
            var cornerRadius = this.getCornerRadius(),
                width = this.getWidth(),
                height = this.getHeight();

            context.save()
            context.beginPath();

            if (!cornerRadius) {
                context.rect(0, 0, width, height);
                context.closePath();
            }
            else {
            	 r9_drawRounded.call(this,context, -cornerRadius, -cornerRadius, width + 2 * cornerRadius, height + 2 * cornerRadius, cornerRadius);
            }

            context.fillStrokeShape(this);
            context.restore();
        }
    };

    Kinetic.Util.extend(Kinetic.R9Menu, Kinetic.Shape);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Menu, 'cornerRadius', 4);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Menu, 'fontFamily', r9_global_font);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Menu, 'fontSize', 18);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Menu, 'menuItems', []);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Menu, 'menuItemColor', null);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Menu, 'addorder', false);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Menu, 'colnum', 1);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Menu, 'prevX', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Menu, 'prevY', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Menu, 'hide', 0);

    Kinetic.R9Menu.prototype.addMenuTextItem = function (layer, content, iconName, callback, userobj) {
        var text = content;
        if (this.addorder()) {
            text = ["A", "B", "C", "D", "E", "F", "G", "H", "I","J","K","L"][this.menuItems().length] + ": " + content;
        }
        var textNode = new Kinetic.R9Text({
            text: text,
            fontSize: this.fontSize(),
            fontFamily: this.fontFamily(),
            fillStyle: this.menuItemColor() ? this.menuItemColor() : "white",
            strokeStyle: this.menuItemColor() ? this.menuItemColor() : "black",
            lineHeight: 1.1,
            padding: 5,
            // fill: 'black' 
        });

        this.addMenuItem(layer, textNode, content, iconName, callback, userobj);
    };

    Kinetic.R9Menu.prototype.addMenuItem = function (layer, textNode, content, iconName, callback, userobj) {
        var that = this;
        var gap = 4, w = this.width(), h = this.height(), addorder = this.addorder(), colnum = this.colnum(),
            prevXoffset = parseFloat(this.prevX()), prevYoffset = parseFloat(this.prevY());


        var tw = parseFloat(textNode.width() + (iconName ? 30 : 0));
        var th = textNode.height();
        if (colnum > 1) {
            if (this.menuItems().length % colnum != 0) {
                textNode.setX(this.getX() + prevXoffset + gap);
                textNode.setY(this.getY() + prevYoffset + gap);
                if (tw + prevXoffset + gap > w) { this.width(tw + prevXoffset + gap); }
                if (h == 0) this.height(th);
                this.prevX(prevXoffset + tw + gap);
            } else {
                textNode.setX(this.getX());
                textNode.setY(this.getY() + h + gap);

                this.prevX(tw);
                this.prevY(h);

                if (tw > w) { this.width(parseFloat(tw)); }
                this.height(h + th + gap);
            }

        } else {
            if (tw > w) { this.width(parseFloat(tw)); }
            this.height(h + th + gap);
            textNode.setY(h + this.getY() + gap); textNode.setX(this.getX());
        }

        layer.add(textNode);
        this.menuItems().push(textNode);
        textNode.on('click tap', function () {
            that.removeAllItems();
            if (callback) { try { callback(content, userobj); } catch (e) { r9_log_console(e); } };
            if (layer)
                layer.draw();
        });
    };

    Kinetic.R9Menu.prototype.removeAllItems = function () {
        try {
            var items = this.menuItems();
            for (var i in items) {
                items[i].remove();
            }
            this.menuItems().length = 0;
        } catch (e) { r9_log_console(e); }
        // this.removeChildren();
        var layer = this.getLayer();
        this.remove();
        if (layer)
            layer.draw();
    };

    Kinetic.Collection.mapMethods(Kinetic.R9Menu);
})(); 
;

(function () {

    Kinetic.R9Rect = function (config) {
        this.___init(config);
    };

    Kinetic.R9Rect.prototype = {
        ___init: function (config) {
            Kinetic.Shape.call(this, config);
            this.className = 'R9Rect';
            this.cloudArray = [];
            if (this.rectType() == 4)
                this.cloudArray = Kinetic.Util.parsePathData(r9_cloud);
            this.sceneFunc(this._sceneFunc);
            this.hitFunc(this._hitFunc);
        },
        _hitFunc: function (context) {
            var width = this.getWidth(), height = this.getHeight();
            context.beginPath();
            context.rect(0, 0, width, height);
            context.closePath();
            context.fillStrokeShape(this);
        },

        _sceneFunc: function (context) {
            var cornerRadius = this.getCornerRadius(),
                width = this.getWidth(),
                height = this.getHeight(),
                rectType = this.getRectType(),
                lastPoint = this.lastPoint(),
                duration = this.duration(),
                strokeWidth = this.strokeWidth(),
                lineType = this.lineBorderType(),
                progressvalue = this.progressvalue(),
                underline = this.getUnderline();


            if (underline == 1) {
                context.beginPath();
                context.moveTo(0, height);
                context.lineTo(width, height);
                context.closePath();
                context.stroke(this);
            }
            var data = [];
            if (rectType == 0) {
                if (underline != 1) {
                    if (!cornerRadius || duration > 0) {
                        if (duration > 0)
                            data = [0, 0, width, 0, width, height, 0, height, 0, 0, width, 0];
                        else {
                        	   
                             context.setAttr('lineWidth', strokeWidth);
                             context.setAttr('strokeStyle', this.getStrokeStyle());
                        	r9_drawLineBorder.call(this, context,  lineType,   width,   height,   cornerRadius,   strokeWidth);
                        }
                    }
                    else {
                        r9_drawRounded.call(this, context, 0, 0, width, height, cornerRadius);
                    }
                }
            } else if (rectType == 1) {
                if (duration > 0)
                    data = [width / 2, 0, width, height / 2, width / 2, height, 0, height / 2, width / 2, 0, width, height / 2];
                else {
                    context.beginPath();
                    context.moveTo(this.getWidth() / 2, 0);
                    context.lineTo(this.getWidth(), this.getHeight() / 2);
                    context.lineTo(this.getWidth() / 2, this.getHeight());
                    context.lineTo(0, this.getHeight() / 2);
                    context.lineTo(this.getWidth() / 2, 0);
                    context.closePath();
                }
            } else if (rectType == 2) {
                if (duration > 0)
                    data = [cornerRadius, 0, width, 0, width - cornerRadius, height, 0, height, cornerRadius, 0, width, 0];
                else {
                    context.beginPath();
                    context.moveTo(cornerRadius, 0);
                    context.lineTo(this.getWidth(), 0);
                    context.lineTo(this.getWidth() - cornerRadius, this.getHeight());
                    context.lineTo(0, this.getHeight());
                    context.lineTo(cornerRadius, 0);
                    context.closePath();
                }
            } else if (rectType == 3) {
                if (duration > 0)
                    data = [cornerRadius, 0, width - cornerRadius, 0, width, height, 0, height, cornerRadius, 0, width - cornerRadius, 0];
                else {
                    context.beginPath();
                    context.moveTo(cornerRadius, 0);
                    context.lineTo(this.getWidth() - cornerRadius, 0);
                    context.lineTo(this.getWidth(), this.getHeight());
                    context.lineTo(0, this.getHeight());
                    context.lineTo(cornerRadius, 0);
                    context.closePath();
                }
            } else if (rectType == 4 && this.cloudArray.length > 0) {
                var scaleX = width / 250.0, scaleY = height / 100.0;
                context.scale(scaleX, scaleY);
                Kinetic.Util.drawPathByData(this, context, this.cloudArray, false);
                context.scale(1 / scaleX, 1 / scaleY);
            }
            if (data.length > 0) {
                var results = r9_drawLinePath.call(this, data, data.length, progressvalue, duration, lastPoint);
                this.lastPoint(results.lastPoint);
                if (typeof results.curdata != 'undefined' && (results.curdata.length > 2)) {
                    var points = results.curdata;
                    context.beginPath();
                    context.moveTo(points[0], points[1]);
                    for (n = 2; n < points.length; n += 2) {
                        context.lineTo(points[n], points[n + 1]);
                    }
                }
            }
            context.fillStrokeShape(this);
            this.drawCorrectMarker(context);
            this.drawSelectionMarker(context);

        }
    };

    Kinetic.Util.extend(Kinetic.R9Rect, Kinetic.Shape);

    Kinetic.Factory.addGetterSetter(Kinetic.R9Rect, 'cornerRadius', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Rect, 'lineBorderType', 'Single'); 
    Kinetic.Factory.addGetterSetter(Kinetic.R9Rect, 'underline', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Rect, 'rectType', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Rect, 'lastPoint', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Rect, 'duration', 0);

    Kinetic.Collection.mapMethods(Kinetic.R9Rect);
})();


(function () {

    Kinetic.R9Queue = function (config) {
        this.___init(config);
    };

    Kinetic.R9Queue.prototype = {
        ___init: function (config) {
            Kinetic.Shape.call(this, config);
            this.className = 'R9Queue';
            this.sceneFunc(this._sceneFunc);
            this.hitFunc(this._hitFunc);
        },
        _hitFunc: function (context) {
            var width = this.getWidth(), height = this.getHeight();
            context.beginPath();
            context.rect(0, 0, width, height);
            context.closePath();
            context.fillStrokeShape(this);
        },

        _sceneFunc: function (context) {
            var w = this.getWidth(),
                h = this.getHeight();
            var fillcolorStr = this.getFillStyle();
            var strokecolorStr = this.getStrokeStyle();
            context.setAttr('fillStyle', fillcolorStr);
            context.setAttr('strokeStyle', strokecolorStr);

            if (w < h) {
                context.setAttr('lineWidth', 1);
                context.beginPath();
                context.moveTo(0, 0);
                context.lineTo(w, 0);
                context.closePath();
                context.stroke(this);
                context.beginPath();
                context.moveTo(0, h);
                context.lineTo(w, h);
                context.closePath();
                context.stroke(this);
                return;
            }
            context.setAttr('lineWidth', 3);
            context.beginPath();
            context.moveTo(0, 0);
            context.lineTo(w - h, 0);
            context.closePath();
            context.stroke(this);
            context.beginPath();
            context.moveTo(0, h);
            context.lineTo(w - h, h);
            context.closePath();
            context.stroke(this);
            context.setAttr('lineWidth', 1);
            context.beginPath();
            context.moveTo(w - h, 0);
            context.lineTo(w, 0);
            context.moveTo(w - h, h);
            context.lineTo(w, h);
            context.strokeShape(this);
        }
    };

    Kinetic.Util.extend(Kinetic.R9Queue, Kinetic.Shape);
    Kinetic.Collection.mapMethods(Kinetic.R9Queue);
})();


(function () {

    Kinetic.R9Stack = function (config) {
        this.___init(config);
    };

    Kinetic.R9Stack.prototype = {
        ___init: function (config) {
            Kinetic.Shape.call(this, config);
            this.className = 'R9Stack';
            this.sceneFunc(this._sceneFunc);
            this.hitFunc(this._hitFunc);
        },
        _hitFunc: function (context) {
            var width = this.getWidth(), height = this.getHeight();
            context.beginPath();
            context.rect(0, 0, width, height);
            context.closePath();
            context.fillStrokeShape(this);
        },
        _sceneFunc: function (context) {
            var w = this.getWidth(),
                h = this.getHeight();
            var fillcolorStr = this.getFillStyle();
            var strokecolorStr = this.getStrokeStyle();
            context.setAttr('fillStyle', fillcolorStr);
            context.setAttr('strokeStyle', strokecolorStr);
            if (w >= h) {
                context.setAttr('lineWidth', 1);
                context.beginPath();
                context.rect(0, 0, w, h);
                context.closePath();
                context.fillStrokeShape(this);
                return;
            }
            context.setAttr('lineWidth', 3);
            context.beginPath();
            context.moveTo(0, w);
            context.lineTo(0, h);
            context.lineTo(w, h);
            context.lineTo(w, w);
            context.stroke(this);
            context.setAttr('lineWidth', 1);
            context.beginPath();
            context.moveTo(0, 0);
            context.lineTo(0, w);
            context.moveTo(w, w);
            context.lineTo(w, 0);
            context.strokeShape(this);
        }
    };

    Kinetic.Util.extend(Kinetic.R9Stack, Kinetic.Shape);
    Kinetic.Collection.mapMethods(Kinetic.R9Stack);
})();;
(function () {

    Kinetic.R9Scratch = function (config) {
        this.___init(config);
    };

    Kinetic.R9Scratch.prototype = {
        ___init: function (config) {

            Kinetic.Shape.call(this, config);
            this.className = 'R9Scratch';
            this.sceneFunc(this._sceneFunc);
            this.hitFunc(this._hitFunc);
        },
        _hitFunc: function (context) {
            var width = this.getWidth(), height = this.getHeight();
            context.beginPath();
            context.rect(0, 0, width, height);
            context.closePath();
            context.fillStrokeShape(this);
        },
        _sceneFunc: function (context) {
            var startX = this.startX(),
                startY = this.startY(),
                width = this.width(),
                height = this.height(),
                duration = this.duration(),
                total = this.total(),
                progressvalue = this.progressvalue(),
                resumeAnimation = this.resumeAnimation(),
                animationColorAll = this.animationColorAll(),
                useAnimationBall = this.useAnimationBall(),
                animationBallColor = this.animationBallColor(),
                animationBallColor2 = this.animationBallColor2(),
                data = this.data(),
                widthcolors = this.widthcolors();

            context.setAttr('lineWidth', this.strokeWidth());
            var count = 0;
            var needToPaint = duration && !useAnimationBall ? Math.ceil(total * progressvalue) : total;

            this.fillEnabled(false);
            var colors = widthcolors ? widthcolors.split("|") : [];

            var pathlist = data.split("|");
            for (var j = 0; j < pathlist.length; j++) {

                if (colors.length > j) {
                    var wc = colors[j].split(";");
                    context.setAttr('strokeStyle', wc[1]);
                    context.setAttr('lineWidth', parseInt(wc[0]));
                }
                context.beginPath();
                var apath = pathlist[j];
                var pointsData = apath.split(",");
                for (var i = 0; i < pointsData.length; i = i + 2) {
                    if (i == 0) {
                        context.moveTo(pointsData[i], pointsData[i + 1]);
                    } else {
                        context.lineTo(pointsData[i], pointsData[i + 1]);
                    }
                    count++;
                    if (count > needToPaint) {
                        break;
                    }
                }
                context.stroke(this);
            } 
            if (useAnimationBall && duration > 0) {
                count = 0;
                needToPaint = total * progressvalue;
                this.fillEnabled(false);
                context.beginPath();
                if (animationBallColor) {
                    context.setAttr('fillStyle', animationBallColor);
                    context.setAttr('strokeStyle', animationBallColor);
                }
                var ballx = 0; var bally = 0;
                for (var j = 0; j < pathlist.length; j++) {
                    var apath = pathlist[j];
                    var pointsData = apath.split(",");
                    for (var i = 0; i < pointsData.length; i = i + 2) {
                        if (animationColorAll) {
                            if (i == 0) {
                                context.moveTo(pointsData[i], pointsData[i + 1]);
                            } else {
                                context.lineTo(pointsData[i], pointsData[i + 1]);
                            }
                        }
                        count++;
                        if (count > needToPaint) {
                            ballx = pointsData[i]; bally = pointsData[i + 1];

                            break;
                        }
                    }
                }
                context.stroke(this);
                if (ballx && bally) {
                    context.save();
                    if (!animationBallColor2)
                        animationBallColor2 = animationBallColor;
                    var gradient4 = context.createRadialGradient(0, 0, 3, 0, 0, 6);
                    gradient4.addColorStop(0, animationBallColor);
                    gradient4.addColorStop(1, animationBallColor2);
                    context.fillStyle = gradient4;
                    context.setAttr('fillStyle', gradient4);
                    context.beginPath();
                    context.arc(ballx, bally, 6, 0, 2 * Math.PI, false);
                    context.fill(this);
                    context.restore();
                }
            }

            this.drawSelectionMarker(context);

        },
        toPathString: function () {
            var data = this.data(), pathlist = data.split("|"), pathStr = '';
            for (var j = 0; j < pathlist.length; j++) {
                var apath = pathlist[j];
                var pointsData = apath.split(",");
                for (var i = 0; i < pointsData.length; i = i + 2) {
                    if (i == 0) {
                        pathStr += " M " + pointsData[i] + " " + pointsData[i + 1];
                    } else {
                        pathStr += " L " + pointsData[i] + " " + pointsData[i + 1];
                    }
                }
            }
            return pathStr;
        }
    };


    Kinetic.Util.extend(Kinetic.R9Scratch, Kinetic.Shape);

    Kinetic.Factory.addGetterSetter(Kinetic.R9Scratch, 'startX', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Scratch, 'startY', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Scratch, 'width', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Scratch, 'height', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Scratch, 'data', '');
    Kinetic.Factory.addGetterSetter(Kinetic.R9Scratch, 'total', 1);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Scratch, 'widthcolors', '');
    Kinetic.Factory.addGetterSetter(Kinetic.R9Scratch, 'duration', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Scratch, 'resumeAnimation', 1);

    Kinetic.Factory.addGetterSetter(Kinetic.R9Scratch, 'strokeRed', '1');
    Kinetic.Factory.addGetterSetter(Kinetic.R9Scratch, 'strokeGreen', '1');
    Kinetic.Factory.addGetterSetter(Kinetic.R9Scratch, 'strokeBlue', '1');
    Kinetic.Factory.addGetterSetter(Kinetic.R9Scratch, 'strokeWidth', 1);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Scratch, 'animationColorAll', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Scratch, 'useAnimationBall', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Scratch, 'animationBallColor', null);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Scratch, 'animationBallColor2', null);

    Kinetic.Collection.mapMethods(Kinetic.R9Scratch);
})();


(function () {

    Kinetic.R9Trace = function (config) {
        this.___init(config);
    };

    Kinetic.R9Trace.prototype = {
        ___init: function (config) { 
            Kinetic.Shape.call(this, config);
            this.className = 'R9Trace';
            this.sceneFunc(this._sceneFunc); 
            if( typeof this.tail_time == 'undefined')
                this.tail_time = 0; 
        }, 
        _sceneFunc: function (context) {
            var   pointsData = this.data() ; 
            context.setAttr('lineWidth', this.strokeWidth());
            context.setAttr('strokeStyle', this.colorStr());  
            for (var i = 0; i < pointsData.length; i = i + 2) {
                if (i == 0) {
                    context.moveTo(pointsData[i], pointsData[i + 1]);
                } else {
                    context.lineTo(pointsData[i], pointsData[i + 1]);
                } 
            }
            context.stroke(this);  
        }, 
        updateLoc: function(progress, duration, accTime){
            var that = this,  data = that.data(), length = data.length, 
                f = that.traced_func, np, same;
           
            if( typeof f == 'function') np = f();
            else if( f instanceof Item) np = f.position; 
            else return;
            if(  length > 2 ){
	            var lsx = data[length-2], lsy = data[length-1];
	            same = np.x == lsx && np.y == lsy;  
            } 
            if(!same){ 
                data.push(np.x);
                data.push(np.y);
            }
            if( that.tail_time ){ 
                if(  length >  that.tail_time * 50 ){
                    data.splice(0,2);
                }
            } 
        } 
    };


    Kinetic.Util.extend(Kinetic.R9Trace, Kinetic.Shape);

    
    Kinetic.Factory.addGetterSetter(Kinetic.R9Trace, 'data', []); 
    Kinetic.Factory.addGetterSetter(Kinetic.R9Trace, 'strokeWidth', 1);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Trace, 'colorStr', 'rgb(255,255,255)'); 

    Kinetic.Collection.mapMethods(Kinetic.R9Trace);
})();
;(function () {

    Kinetic.R9Sprite = function (config) {
        this.___init(config);
    };

    Kinetic.R9Sprite.prototype = {
        ___init: function (config) {
            // call super constructor
            Kinetic.Shape.call(this, config);
            this.className = 'R9Sprite';
            this._oldState = null;
            this._updated = true;
            var that = this;
            this.anim = new Kinetic.Animation(function () {
                // if we don't need to redraw layer we should return false
                var updated = that._updated;
                that._updated = false;
                return updated;
            });
            this.on('animationChange.kinetic', function () {
                // reset index when animation changes
                that.frameIndex(0);
            });
            this.on('frameIndexChange.kinetic', function () {
                that._updated = true;
            });
            // smooth change for frameRate
            this.on('frameRateChange.kinetic', function () {
                if (!that.anim.isRunning()) {
                    return;
                }
                clearInterval(that.interval);
                that._setInterval();
            });

            this.sceneFunc(this._sceneFunc);
            this.hitFunc(this._hitFunc);
        },
        _sceneFunc: function (context) {
            var animIndex = this.getAnimation(),
                index = this.frameIndex(),
                ix4 = index * 4,
                set = this.getAnimations()[animIndex],
                x = set[ix4 + 0],
                y = set[ix4 + 1],
                width = set[ix4 + 2],
                height = set[ix4 + 3],
                image = this.getImage(), params,
                r9cropX, r9cropY, r9cropWidth, r9cropHeight;

            if (image) {
                this.fwidth(width);
                this.fheight(height);
                r9cropX = this.getR9cropX();
                r9cropY = this.getR9cropY();
                r9cropWidth = this.getR9cropWidth();
                r9cropHeight = this.getR9cropHeight();

                if (r9cropWidth && r9cropHeight) {
                    context.drawImage(image, x + r9cropX, y + r9cropY, r9cropWidth, r9cropHeight, 0, 0, width, height);
                } else {
                    context.drawImage(image, x, y, width, height, 0, 0, width, height);
                }

            }
            this.drawSelectionMarker(context);
        },
        _hitFunc: function (context) {
            var animIndex = this.getAnimation(),
                index = this.frameIndex(),
                ix4 = index * 4,
                set = this.getAnimations()[animIndex],
                width = set[ix4 + 2],
                height = set[ix4 + 3];

            context.beginPath();
            context.rect(0, 0, width, height);
            context.closePath();
            context.fillShape(this);
        },
        _useBufferCanvas: function () {
            return (this.hasShadow() || this.getAbsoluteOpacity() !== 1) && this.hasStroke();
        },
        _setInterval: function () {
            var that = this;
            this.interval = setInterval(function () {
                that._updateIndex();
            }, 1000 / this.getFrameRate());
        },

        start: function () {
            var layer = this.getLayer();

            this.anim.setLayers(layer);
            this._setInterval();
            this.anim.start();
        },

        stop: function () {
            this.anim.stop();
            clearInterval(this.interval);
        },

        isRunning: function () {
            return this.anim.isRunning();
        },
        provoke: function (newState) {
            var _oldState = this.getAnimation();
            if (_oldState == newState) return;
            this._oldState = _oldState;
            this.changeState(newState);
        },
        changeState: function (newState,  provoked) {
        	if( !!provoked ){
        		this.provoke(newState);
        		return;
        	}
            this.stop();
            this.frameIndex(0);
            this.setAnimation(newState);
            this.start();
        },
        hasState: function(state){
        	return typeof this.getAnimations()[state] != 'undefined';
        },
        
        _updateIndex: function () {
            var index = this.frameIndex(),
                animIndex = this.getAnimation(),
                animations = this.getAnimations(),
                animConfig = animations[animIndex],
                len = animConfig.length / 4;

            if (index < len - 1) {
                this.frameIndex(index + 1);
            }
            else {
                if (this._oldState) {
                    this.setAnimation(this._oldState);
                    this._oldState = null;
                } else {
                    if (this.norepeat() == 0) {
                        this.frameIndex(0);
                    } else {
                        this.stop();
                    }
                }
            }
        }
    };
    Kinetic.Util.extend(Kinetic.R9Sprite, Kinetic.Shape);

    // add getters setters
    Kinetic.Factory.addGetterSetter(Kinetic.R9Sprite, 'animation');
    Kinetic.Factory.addGetterSetter(Kinetic.R9Sprite, 'animations');
    Kinetic.Factory.addGetterSetter(Kinetic.R9Sprite, 'image');
    Kinetic.Factory.addGetterSetter(Kinetic.R9Sprite, 'frameIndex', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Sprite, 'frameRate', 17);
    Kinetic.Factory.backCompat(Kinetic.R9Sprite, {
        index: 'frameIndex',
        getIndex: 'getFrameIndex',
        setIndex: 'setFrameIndex'
    });

    Kinetic.Factory.addGetterSetter(Kinetic.R9Sprite, 'duration', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Sprite, 'fwidth', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Sprite, 'fheight', 0);

    Kinetic.Factory.addComponentsGetterSetter(Kinetic.R9Sprite, 'r9crop', ['x', 'y', 'width', 'height']);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Sprite, 'r9cropX', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Sprite, 'r9cropY', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Sprite, 'r9cropWidth', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Sprite, 'r9cropHeight', 0);

    Kinetic.Factory.addComponentsGetterSetter(Kinetic.R9Sprite, 'fcrop', ['x', 'y', 'width', 'height']);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Sprite, 'fcropX', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Sprite, 'fcropY', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Sprite, 'fcropWidth', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Sprite, 'fcropHeight', 0);


    Kinetic.Factory.addComponentsGetterSetter(Kinetic.R9Sprite, 'tcrop', ['x', 'y', 'width', 'height']);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Sprite, 'tcropX', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Sprite, 'tcropY', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Sprite, 'tcropWidth', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Sprite, 'tcropHeight', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Sprite, 'norepeat', 0);

    Kinetic.R9Sprite.prototype.progress = function (progress, dur) {
        if (dur == 0) return;
        var width = this.fwidth(),
            height = this.fheight(),
            fcropX = this.fcropX(), fcropY = this.fcropY(),
            fcropWidth = this.fcropWidth() || width, fcropHeight = this.fcropHeight() || height,
            tcropX = this.tcropX(), tcropY = this.tcropY(),
            tcropWidth = this.tcropWidth() || width, tcropHeight = this.tcropHeight() || height;
        if (fcropWidth === tcropWidth && fcropHeight === tcropHeight)
            return;
        this.r9crop({
            x: fcropX + (tcropX - fcropX) * progress,
            y: fcropY + (tcropY - fcropY) * progress,
            width: fcropWidth + (tcropWidth - fcropWidth) * progress,
            height: fcropHeight + (tcropHeight - fcropHeight) * progress
        });

    };

    Kinetic.R9Sprite.prototype.changeCrop = function (cx, cy, cw, ch) {
        var tcropX = this.tcropX(), tcropY = this.tcropY(),
            tcropWidth = this.tcropWidth(), tcropHeight = this.tcropHeight();
        this.tcrop({ x: cx, y: cy, width: cw, height: ch });
        if (tcropWidth === 0 || tcropHeight === 0) {
        } else {
            this.fcrop({ x: tcropX, y: tcropY, width: tcropWidth, height: tcropHeight });
        }
    };

    Kinetic.Collection.mapMethods(Kinetic.R9Sprite);
})();


/**
 *  this data model is from mpaper.js::: 
     *     animation: 'standing', 
     *     data:  [ 
     *        {
     *           data:  //raw path data
     *           adjusted:
     *        },
     *         {
     *           data: 
     *           adjusted:
     *        },
     *     ],
     *     animations: {
     *       standing: { 
     *           dataindex: [0,1],
     *           morphtime:  //in second.
     *           yoyo: true|false
     *       },
     *       kicking: [
     *            dataindex: [0,1],
     *           morphtime:  //in second.
     *           yoyo: true|false
     *       ]          
     *     }   
 */

(function () {

    Kinetic.R9SpriteSVG = function (config) {
        this.___init(config);
    };

    Kinetic.R9SpriteSVG.prototype = {
        ___init: function (config) {
            // call super constructor  

            Kinetic.Shape.call(this, config);
            this.className = 'R9SpriteSVG';

            this._updated = true;
            this.running = false;
            this.lastAniTime = 0;
            this.startAniTime = 0;
            this._cursvg = null;
            this._reverse = false;
            var that = this;
            this.anim = new Kinetic.Animation(function () {
                // if we don't need to redraw layer we should return false
                var updated = that._updated;
                that._onFrame();
                that._updated = false;
                return updated;
            });
            this.on('animationChange.kinetic', function () {
                // reset index when animation changes
                that._onFrame();
            });
            this.on('frameIndexChange.kinetic', function () {
                that._updated = true;
            });
            // smooth change for frameRate
            this.on('frameRateChange.kinetic', function () {
                if (!that.anim.isRunning()) {
                    return;
                }
                clearInterval(that.interval);
                that._setInterval();
            });

            this.sceneFunc(this._sceneFunc);
            this.hitFunc(this._hitFunc);
        },
        _sceneFunc: function (context) {
            if (this._cursvg)
                this._cursvg._sceneFunc(context);
        },

        _onChangeState: function () {
            var that = this, setting = that._change_state, oldState = setting.oldState, provoke = setting.provoke,
                morphtime = that.changeStateDuration() * 1000,
                animations = this.getAnimations(), etime = new Date().getTime(), data = this.getData();
               
            
                if (that.startAniTime == 0)
                    that.startAniTime = etime;
               var tdif = etime - that.startAniTime; // console.log(tdif);
             if (  tdif <= morphtime ) { 
                var progress = (tdif) / morphtime;
               // console.log("progress " + progress);
                if (that._cursvg == null) {
                    that._cursvg = new Kinetic.Path({
                        data: data[setting.fromIndex].data,
                        stroke: data[setting.fromIndex].stroke_color,
                        fill: data[setting.fromIndex].fill_color,
                        fillAlpha: data[setting.fromIndex].fill_opacity,
                        todata: data[setting.toIndex].data,
                        tofill: data[setting.toIndex].fill_color,
                        tostroke: data[setting.toIndex].stroke_color,
                        strokeWidth: that.strokeWidth() || 1,
                    })
                    that._cursvg.startMorph();
                }
                if (that._cursvg.readyMorphing())
                    that._cursvg.renderMorphStep(progress);
            } else {
            	if (that._cursvg.readyMorphing())
                    that._cursvg.renderMorphStep(1);
                that.stop();
                that._reset();
                that._change_state = null;
                that._duration_change_state = false;
                if (provoke) {
                    that.changeState(oldState)
                } else {
                    that.animation(setting.newState);
                    that.start();
                }
            }
        },
        _onFrame: function () {
            var that = this;
            if (!that.isRunning()) return;
            if (that._duration_change_state) {
                that._onChangeState();
                return;
            }
            var anim = this.getAnimation(), animsetting = this.getAnimations()[anim],
                dataindex = animsetting.dataindex, yoyo = animsetting.yoyo,
                morphtime = animsetting.morphtime * 1000, etime = new Date().getTime(),
                data = this.getData();
            if (dataindex.length == 1) {
                that.stop();
                that._reset();
                that._cursvg = new Kinetic.Path({
                    data: data[dataindex[0]].data,
                    stroke: data[dataindex[0]].stroke_color,
                    fill: data[dataindex[0]].fill_color,
                    fillAlpha: data[dataindex[0]].fill_opacity,
                    strokeWidth: that.strokeWidth() || 1,
                });
                that.getLayer().batchDraw();
                return;
            }
            //            dataindex: [],
            //           morphtime:  //in second.
            //          yoyo: true|false 
            if (that.startAniTime == 0)
                that.startAniTime = etime;
            var timeused = (etime - that.startAniTime) ;
            if ( timeused <= morphtime  ) { 
                var span = morphtime / (dataindex.length - (yoyo ? 0 : 1)) ,
                    curindex = parseInt(timeused / span),
                    progress = (timeused - curindex * span) / span;
                if (animsetting.curindex != curindex || that._cursvg == null) {
                    animsetting.curindex = curindex;
                    if (curindex >= dataindex.length - 1)
                        that._cursvg = new Kinetic.Path({
                            data: data[dataindex[curindex - 1]].data,
                            stroke: data[dataindex[curindex - 1]].stroke_color,
                            fill: data[dataindex[curindex - 1]].fill_color,
                            fillAlpha: data[dataindex[curindex - 1]].fill_opacity,
                            todata: data[dataindex[0]].data,
                            strokeWidth: that.strokeWidth() || 1
                        });
                    else
                        that._cursvg = new Kinetic.Path({
                            data: data[dataindex[curindex]].data,
                            stroke: data[dataindex[curindex]].stroke_color,
                            fill: data[dataindex[curindex]].fill_color,
                            fillAlpha: data[dataindex[curindex]].fill_opacity,
                            todata: data[dataindex[curindex + 1]].data,
                            strokeWidth: that.strokeWidth() || 1
                        });
                    that._cursvg.startMorph();
                }
                if (that._cursvg.readyMorphing())
                    that._cursvg.renderMorphStep(progress);
            } else {
                if (that._change_state != null) {
                    //  that._reset( ); 
                    that._duration_change_state = true;
                }
                else if (animsetting.yoyo) {
                    that._reset();
                } else {
                    that.stop();
                    that._reset();
                }
            }
        },
        _hitFunc: function (context) {
            if (this._cursvg)
                this._cursvg.hitFunc(context);
        },
        _useBufferCanvas: function () {
            return (this.hasShadow() || this.getAbsoluteOpacity() !== 1) && this.hasStroke();
        },
        _setInterval: function () {
            var that = this;
            this.interval = setInterval(function () {
                //  that._updateIndex();
            }, 200);
        },

        start: function () {
            var layer = this.getLayer();
            this.anim.setLayers(layer);
            this._setInterval();
            this.anim.start();
        },

        stop: function () {
            this.anim.stop();
            clearInterval(this.interval);
        },

        isRunning: function () {
            return this.anim.isRunning();
        },

        _reset: function () {
            this.lastAniTime = 0;
            this.startAniTime = 0;
            this._cursvg = null;
        },
        _get_cursvg: function (data) {
            if (this._cursvg == null) {
                this._cursvg = new Kinetic.Path({ data: data });
                this._cursvg.visible = false;
            } else {
                this._cursvg.setData(data);
            }
            return this._cursvg;
        },
        hasState: function(state){
        	return typeof this.getAnimations()[state] != 'undefined';
        },

        changeState: function (animation, provoked) {
            var curState = this.getAnimation();
            if( !curState || curState == animation){
            	this.setAnimation(animation); 
                if (!this.isRunning()) {
                    this._reset();
                    this.start();
                }
                return;
            }
            this._change_state = {
                newState: animation,
                provoked: !!provoked,
                oldState: curState,
                fromIndex: this.getAnimations()[curState].dataindex[0],
                toIndex: this.getAnimations()[animation].dataindex[0]
            }
            this._duration_change_state = true;
            this.stop();
            this._reset();
            this.start();
        }
    };
    Kinetic.Util.extend(Kinetic.R9SpriteSVG, Kinetic.Shape);

    // add getters setters
    Kinetic.Factory.addGetterSetter(Kinetic.R9SpriteSVG, 'animation');
    Kinetic.Factory.addGetterSetter(Kinetic.R9SpriteSVG, 'animations');
    Kinetic.Factory.addGetterSetter(Kinetic.R9SpriteSVG, 'data');
    Kinetic.Factory.addGetterSetter(Kinetic.R9SpriteSVG, 'changeStateDuration', 1);
 
    Kinetic.Collection.mapMethods(Kinetic.R9SpriteSVG);
})();


(function () {
    Kinetic.R9CheckboxSVG = function (config) {
        this.__init2(config);
    };

    Kinetic.R9CheckboxSVG.prototype = {
        __init2: function (config) {
            // call super constructor   
            Kinetic.R9SpriteSVG.call(this, config);
            this.className = 'R9CheckboxSVG';
            this._checked = 0;
        },
        checked: function (value) {
        	if( typeof value == 'undefined' ) return this._checked;
        	this._checked = value;
            this.changeState(value ? "selected" : "unselected");
        }
    };

    Kinetic.Util.extend(Kinetic.R9CheckboxSVG, Kinetic.R9SpriteSVG);
    Kinetic.Factory.addGetterSetter(Kinetic.R9CheckboxSVG, 'dummy');
    Kinetic.Collection.mapMethods(Kinetic.R9CheckboxSVG);
})(); 
;

(function () {

    Kinetic.R9LineTip = function (config) {
        this.___init(config);
    };

    Kinetic.R9LineTip.prototype = {
        ___init: function (config) {

            Kinetic.Shape.call(this, config);
            this.className = 'R9LineTip';
            this.sceneFunc(this._sceneFunc);
            // this.hitFunc(this._hitFunc);
        },
        // _hitFunc : function(context) {
        //  var startX = this.startX(),
        // startY = this.startY(),
        // endX = this.endX(),
        // endY = this.endY();
        //            context.beginPath();
        //            context.rect(startX, startY, Math.abs(endX-startX), Math.abs(endY-startY));
        //            context.closePath();
        //            context.fillStrokeShape(this); 
        // },
        _sceneFunc: function (context) {
            var startX = this.startX(),
                startY = this.startY(),
                endX = this.endX(),
                endY = this.endY(),
                targetStartX = this.targetStartX(),
                targetStartY = this.targetStartY(),
                targetEndX = this.targetEndX(),
                targetEndY = this.targetEndY(),
                arrawdash = this.arrawdash(),
                duration = this.duration(),
                progressvalue = this.progressvalue(),
                headEnd = this.headend(),
                strokeWidth = this.strokeWidth() || 1,
                dragTarget = this.dragTarget(),
                tipOffset = this.tipOffset(),
                lineOffsetStart = this.lineOffsetStart(),
                lineOffsetEnd = this.lineOffsetEnd(),
                dash2solid = this.dash2solid();

            var start = new Point(startX, startY), end = new Point(endX, endY),
                len = start.distance( end), angle = start.calcAngle(  end);
            if (len - lineOffsetStart > 0) {
                start = start.calcPoint( angle, lineOffsetStart);
                startX = start.x;
                startY = start.y;
            }
            if (len - lineOffsetEnd > 0) {
                end = start.calcPoint(  angle, len - lineOffsetEnd - lineOffsetStart);
                endX = end.x;
                endY = end.y;
            }


            if (targetEndX != -99999) {
                endX = targetEndX - this.getX();
                endY = targetEndY - this.getY();
            }

            if (targetStartX != -99999) {
                startX = targetStartX - this.getX();
                startY = targetStartY - this.getY();
            }


            if (dragTarget) {
                try {
                    endX = dragTarget.getX();
                    endY = dragTarget.getY();
                } catch (err) { r9_log_console(err); }
            }

            var d2sX = startX, d2sY = startY;
            if (dash2solid > 0) {
                d2sX = endX - (endX - startX) * dash2solid * 1.0 / 100;
                d2sY = endY - (endY - startY) * dash2solid * 1.0 / 100;
            }
            var d2s = new Point(d2sX, d2sY);

            if (duration > 0) {
                endX = startX + (endX - startX) * progressvalue;
                endY = startY + (endY - startY) * progressvalue;
            }


            if (this.checked()) {
                this.strokeWidth(1),
                    context.setAttr('strokeStyle', 'rgba(255,0,0,1)');
                context.beginPath();
                context.rect(Math.min(0, endX), Math.min(0, endY), Math.abs(endX - startX), Math.abs(endY - startY));
                context.closePath();
                context.stroke(this);
                this.strokeWidth(strokeWidth);
            }

            start = new Point(startX, startY);
            end = new Point(endX, endY);
          
            var newStart = start;
            var newEnd = end;
            var arrowSize = strokeWidth * 3; if (arrowSize < 10) arrowSize = 10;


            if (headEnd == 'ArrowEnd') {
                newEnd = end.calcPoint( angle + 180, arrowSize - 5 - tipOffset);
            }

            if (headEnd == 'BraceEnd') {
                var anglestart = 45;
                var angleend = 45 + 90;
                context.beginPath();
                var ap1 = start.calcPoint( angle + anglestart, 10);
                var ap11 = start.calcPoint(  angle + 180, 5);
                context.moveTo(start.x, start.y);
                context.quadraticCurveTo(ap11.x, ap11.y, ap1.x, ap1.y);

                var ap2 = end.calcPoint(  angle + angleend, 10);
                var ap22 = end.calcPoint(  -angle + 180, 5);
                context.moveTo(end.x, end.y);
                context.quadraticCurveTo(ap22.x, ap22.y, ap2.x, ap2.y);


                var d = Math.sqrt((ap1.x - ap2.x) * (ap1.x - ap2.x) + (ap1.y - ap2.y) * (ap1.y - ap2.y));
                d = d / 2 - 5;
                var ap11 = ap1.calcPoint(  angle, d);
                context.moveTo(ap1.x, ap1.y);
                context.lineTo(ap11.x, ap11.y);
                var ap21 = ap1.calcPoint(  angle, d + 10);
                context.moveTo(ap21.x, ap21.y);
                context.lineTo(ap2.x, ap2.y);

                var app = ap11.calcPoint(  angle + anglestart, Math.sqrt(50));
                context.moveTo(ap11.x, ap11.y);
                context.lineTo(app.x, app.y);
                context.lineTo(ap21.x, ap21.y);

                context.fillStrokeShape(this);
                return;
            }

            if (duration > 0 && progressvalue == 0)
                return;

            if (dash2solid > 0) {
                if (duration == 0 || (progressvalue * 1.0 > dash2solid * 1.0 / 100)) {
                    this.setDash(arrawdash == 1 ? [5, 5] : [0, 0]);
                    context.beginPath();
                    context.moveTo(newStart.x, newStart.y);
                    context.lineTo(d2s.x, d2s.y);
                    context.fillStrokeShape(this);
                    this.setDash(arrawdash == 1 ? [0, 0] : [5, 5]);
                    context.beginPath();
                    context.moveTo(d2s.x, d2s.y);
                    context.lineTo(newEnd.x, newEnd.y);
                    context.fillStrokeShape(this);
                } else {
                    this.setDash(arrawdash == 1 ? [5, 5] : [0, 0]);
                    context.beginPath();
                    context.moveTo(newStart.x, newStart.y);
                    context.lineTo(newEnd.x, newEnd.y);
                    context.fillStrokeShape(this);
                }
            } else {
                this.setDash(arrawdash == 1 ? [5, 5] : [0, 0]);
                context.beginPath();
                context.moveTo(newStart.x, newStart.y);
                context.lineTo(newEnd.x, newEnd.y);
                context.fillStrokeShape(this);
            }


            var sw = strokeWidth;
            this.setDash([0, 0]);
            context.beginPath();
            if (sw < 0) {
                if (headEnd == 'ArrowEnd') {
                    var ap1 = end.calcPoint(  angle - 45 - 90, 15);
                    context.moveTo(end.x, end.y);
                    context.lineTo(ap1.x, ap1.y);

                    var ap2 = end.calcPoint(  angle + 45 + 90, 15);
                    context.moveTo(end.x, end.y);
                    context.lineTo(ap2.x, ap2.y);
                }
            } else {
                var aheadsize = sw * 3; if (sw < 10) sw = 10;
                if (headEnd == 'ArrowEnd') {
                    var newEnd = end;
                    var ap1 = newEnd.calcPoint(  angle - 45 - 90, aheadsize);
                    context.moveTo(newEnd.x, newEnd.y);
                    context.lineTo(ap1.x, ap1.y);
                    var ap2 = newEnd.calcPoint(  angle + 45 + 90, aheadsize);
                    context.lineTo(ap2.x, ap2.y);
                    context.lineTo(newEnd.x, newEnd.y);
                }
            }
            var sw = strokeWidth;
            var aheadsize = sw * 2; if (sw < 4) sw = 4;
            if (headEnd == 'BallEnd') {
                context.moveTo(end.x, end.y);
                context.arc(end.x, end.y, aheadsize, 0, 2 * Math.PI);
            }
            if (headEnd == 'SquareEnd') {
                context.moveTo();
                context.beginPath();
                context.rect(end.x - sw, end.y - sw, sw * 2, sw * 2);
                context.closePath();
            }

            context.fillStrokeShape(this);

        },
        getDataPointAt: function (pos) {
            if (pos == 0) {
                var x = this.startX(), y = this.startY();
                return new Point(x, y);
            }
            var x = this.endX(), y = this.endY();
            return new Point(x, y);
        },
        setDataPointAt: function (pos, point) {
            if (pos == 0) {
                this.setStartX(point.x);
                this.setStartY(point.y);
            } else {
                this.setEndX(point.x);
                this.setEndY(point.y);
            }
        },
        changeDataPointAt: function (pos, shift) {
            if (pos == 0) {
                this.setStartX(this.getStartX() + shift.x);
                this.setStartY(this.getStartY() + shift.y);
            } else {
                this.setEndX(this.getEndX() + shift.x);
                this.setEndY(this.getEndY() + shift.y);
            }
        },
        toPathString: function () {
            var startX = this.startX(),
                startY = this.startY(),
                endX = this.endX(),
                endY = this.endY();
            return "M " + startX + " " + startY +
                " L " + endX + " " + endY + " ";
        }
    };
    Kinetic.Util.extend(Kinetic.R9LineTip, Kinetic.Shape);

    Kinetic.Factory.addGetterSetter(Kinetic.R9LineTip, 'startX', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9LineTip, 'startY', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9LineTip, 'endX', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9LineTip, 'endY', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9LineTip, 'targetStartX', -99999);
    Kinetic.Factory.addGetterSetter(Kinetic.R9LineTip, 'targetStartY', -99999);
    Kinetic.Factory.addGetterSetter(Kinetic.R9LineTip, 'targetEndX', -99999);
    Kinetic.Factory.addGetterSetter(Kinetic.R9LineTip, 'targetEndY', -99999);
    Kinetic.Factory.addGetterSetter(Kinetic.R9LineTip, 'headend', 'ArrowEnd');
    Kinetic.Factory.addGetterSetter(Kinetic.R9LineTip, 'arrawdash', 0);

    Kinetic.Factory.addGetterSetter(Kinetic.R9LineTip, 'strokeRed', '1');
    Kinetic.Factory.addGetterSetter(Kinetic.R9LineTip, 'strokeGreen', '1');
    Kinetic.Factory.addGetterSetter(Kinetic.R9LineTip, 'strokeBlue', '1');
    Kinetic.Factory.addGetterSetter(Kinetic.R9LineTip, 'strokeWidth', 1);
    Kinetic.Factory.addGetterSetter(Kinetic.R9LineTip, 'duration', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9LineTip, 'dragTarget', null);
    Kinetic.Factory.addGetterSetter(Kinetic.R9LineTip, 'dash2solid', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9LineTip, 'curvetype', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9LineTip, 'tipOffset', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9LineTip, 'lineOffsetStart', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9LineTip, 'lineOffsetEnd', 0);
    Kinetic.Collection.mapMethods(Kinetic.R9LineTip);
})();
 ;//  //0 : static text, 1: show text increasely 2: use text as background  3: use underline as animation 
//4: karaoka    5: manim-style  6: manim-style2 
//    0 static, 1 writing, 2 rewriting, 3 underline, 4 karaoka,  5 manim

(function () {

    var AUTO = 'auto',

        CENTER = 'center', CHANGE_KINETIC = 'Change.kinetic', CONTEXT_2D = '2d', DASH = '-', EMPTY_STRING = '', LEFT = 'left', TEXT = 'text', TEXT_UPPER = 'Text', MIDDLE = 'middle', NORMAL = 'normal', PX_SPACE = 'px ', SPACE = ' ', RIGHT = 'right', WORD = 'word', CHAR = 'char', NONE = 'none', ATTR_CHANGE_LIST = [
            'fontFamily', 'fontSize', 'fontStyle', 'fontVariant', 'padding',
            'align', 'lineHeight', 'text', 'width', 'height', 'wrap'],


        attrChangeListLen = ATTR_CHANGE_LIST.length, dummyContext = Kinetic.Util
            .createCanvasElement().getContext(CONTEXT_2D);

    var _curFontFamily, _curFontStyle, _curFontWeight,
        _curR9textstyle, _defaultStroke ;

    Kinetic.R9Text = function (config) {
        this.___init(config);
        this.cloudArray = [];
        if (this.borderType() == 'Cloud')
            this.cloudArray = Kinetic.Util.parsePathData(r9_cloud);
    };
    function _fillFunc(context) { 
        context.lineWidth = 1;
      //  context.setAttr("strokeStyle", this.getStrokeStyle());
        context.setAttr("fillStyle", this._curTextColor || this.getStrokeStyle());
        context.fillText(this.partialText, 0, 0);
    }
    function _strokeFunc(context) { 
        if (this.drawunderline()) {  //
            dummyContext.save();
            dummyContext.font = this._getContextFont();
            context.beginPath();
            context.moveTo(0, this._getLineHeightPx() / 3);
            context.lineTo(this._getTextWidth(this.partialText), this._getLineHeightPx() / 3);
            context.stroke();
            dummyContext.restore();
            return;
        }
        context.lineWidth = 1;
        if (this.getSft() == 5 && this.text() != this.otext())
        	  context.setAttr("strokeStyle",this._curTextColor || this.getStrokeStyle());
        	// context.setAttr("fillStyle", this.getStrokeStyle());
            context.strokeText(this.partialText, 0, 0);
        if (this.getSft() == 6 && this.gend() != 0) {
            var offx6 = 0; 
          //  context.setAttr("fillStyle", this.getStrokeStyle());
            context.setAttr("strokeStyle", this._curTextColor || this.getStrokeStyle());
            context.strokeText(this.partialText, offx6, 0);
            context.setAttr('fillStyle', this.effectColorStr());
            context.setAttr('strokeStyle', this.effectColorStr());
            var wh6 = this._getLineHeightPx() * 0.75;
            context.translate(0, -wh6 / 2);
            for (var i = 0; i < 16; i++) {
                var x0 = Math.random() * wh6 * 3;
                var y0 = Math.random() * wh6;
                context.beginPath();
                context.rect(offx6 + x0, y0, wh6 * 0.2, wh6 * 0.25);
                context.closePath();
                context.fill(this);
            }

            return;
        }
     //   context.setAttr("fillStyle", this.getStrokeStyle());
        context.setAttr("strokeStyle", this._curTextColor || this.getStrokeStyle());
        context.strokeText(this.partialText, 0, 0);


        if (!this._curR9textstyle)
            return;
        if (this._curR9textstyle.u) {
            context.beginPath();
            context.moveTo(0, this._getLineHeightPx() / 3);
            context.lineTo(this._curR9textstyle.width, this._getLineHeightPx() / 3);
            context.stroke();
        }


        if (this._curR9textstyle.strike) {
            context.beginPath();
            context.moveTo(0, 0);
            context.lineTo(this._curR9textstyle.width, 0);
            context.stroke();
        }
    }

    Kinetic.R9Text.prototype = {
        ___init: function (config) {
            var that = this;

            if (config.width === undefined) {
                config.width = AUTO;
            }
            if (config.height === undefined) {
                config.height = AUTO;
            }


            Kinetic.Shape.call(this, config);

            this._fillFunc = _fillFunc;
            this._strokeFunc = _strokeFunc;
            this.className = TEXT_UPPER;


            for (var n = 0; n < attrChangeListLen; n++) {
                this
                    .on(ATTR_CHANGE_LIST[n] + CHANGE_KINETIC,
                        that._setTextData);
            }

            var stdsize = this.getR9stdsize();
            if (stdsize > 0) {
                var teststr = this.getR9stdline();
                dummyContext.font = this._getContextFont();
                var tsize = dummyContext.measureText(teststr).width;
                this.setScaleX((1.0 * stdsize) / tsize);
            }

            this._setTextData();
            this.sceneFunc(this._sceneFunc);
            this.hitFunc(this._hitFunc);
        },
        _drawBackground: function (context) {
            var width = this.getWidth(), height = this.getHeight(),
                useBackground = this.useBackground(), borderColorStr = this.borderColorStr(),
                corner = this.corner(), borderWidth = this.borderWidth(), borderType = this.borderType() ,
                lineType = this.lineBorderType(),
                textXOffset = this.textXOffset(), textYOffset = this.textYOffset();
            if (!useBackground && !(borderType != 'None' || borderWidth > 0))
                return;
            if( this.getR9vsize() > 0 )
            	height = this.getR9vsize() * this. _getLineHeightPx() ;
            context.save();

            var bgcolorStr = this.getFillStyle();
            if (borderColorStr  || lineType !== 'Single') {
                borderColorStr = borderColorStr ||  this.getStrokeStyle();
                context.setAttr('lineWidth', borderWidth || 1);
                context.setAttr('fillStyle', bgcolorStr);
                context.setAttr('strokeStyle', borderColorStr); 
            } else {
                // this.strokeWidth(1),
               context.setAttr('lineWidth',    0 );
                context.setAttr('fillStyle', bgcolorStr);
                context.setAttr('strokeStyle', bgcolorStr);
            }
            if (borderType == 'Cloud') {
                var scaleX = width / 250.0, scaleY = height / 100.0;
                context.scale(scaleX, scaleY);
                Kinetic.Util.drawPathByData(null, context, this.cloudArray, true);
                context.scale(1 / scaleX, 1 / scaleY);  
            }
            else if (!corner) {
            	if( borderType == 'Normal')
            	    r9_drawLineBorder.call(this, context,  lineType,   width,   height,   corner,   borderWidth); 
            	else if( borderType == 'Underline' ){
            		 context.beginPath();
                     context.moveTo(0, height);
                     context.lineTo(width, height); 
            	} else if( borderType == 'Cross' ){
           		    context.beginPath();
                    context.moveTo(0, 0);
                    context.lineTo(width, height); 
                    context.moveTo(0, height);
                    context.lineTo(width, 0); 
        	   }
            } else {
                r9_drawRounded.call(this, context, 0, 0, width, height, corner);  
            } 
            context.fill();
            context.stroke();
            context.restore();
        },
        _sceneFunc: function (context) {
            var sft = this.getSft(), needToPaint = this.needToPaint(), duration = this.duration(), otext = this.otext(), text = this.text(),
                expression = this.expression(), math = this.math(), useBackground = this.useBackground(), glow = this.glow(),
                textXOffset = this.textXOffset(), textYOffset = this.textYOffset();


            // for click-hit test
            // var width = this.getWidth(), height = this.getHeight();
            // context.beginPath();
            // context.rect(0,0,width,height);
            // context._context.fillStyle = 'rgba('
            // +this.getStrokeRed()+','+this.getStrokeGreen() + ',' +
            // this.getStrokeBlue() + ',0.001)'
            // context.fill();
            // end click-hit test

            if (math) {
                this.setText("");
                this._setTextData();
                this._sceneFuncImpl(context, false, false);
                return;
            }

            if (expression) {
                this.setText(eval(expression));
                var r9vs = this.getText();
                var r9v = Number(r9vs);
                if (!Number.isNaN(r9v)) {
                    r9vs = r9v.toFixed(this.getFixed());
                    r9v = parseFloat(r9vs);
                    this.setText(otext + r9v + "");
                }
                this._setTextData();
                this._sceneFuncImpl(context, false, false);
                return;
            }
            if (sft == 0 || duration == 0) {
                this.setText(text || otext);
                this._setTextData();
                this._sceneFuncImpl(context, false, false);
                return;
            }
            if (sft == 4) {
                var fullTextWidth = this.kalaoktextwidth();
                if (fullTextWidth == 0) {
                    this.setText(otext);
                    this._setTextData();
                    fullTextWidth = this.textWidth;
                    this.kalaoktextwidth(fullTextWidth);
                }
                var kalaokoffset = this.kalaokoffset();
                if (kalaokoffset > 0) {
                    var width = this.kalaokwidth() || this.getWidth();
                    var diff = this.getX() + width - kalaokoffset;
                    if (diff <= 0) {
                        this.setText("");
                    } else {
                        var showStr = diff * otext.length / fullTextWidth;
                        this.setText(otext.substr(0, showStr));
                    }
                } else {
                    var diff = - kalaokoffset;
                    var showStr = Math.ceil(diff * otext.length / fullTextWidth);
                    this.setText(otext.substr(showStr));
                }
                this._setTextData();
                this._sceneFuncImpl(context, false, false);
                return;
            }
            if (sft == 3) {
                this.setText(otext);
                this._setTextData();
                this._sceneFuncImpl(context, false, false);
                this.drawunderline(1);
                if (needToPaint > 0) {
                    this.setText(otext.substr(0, needToPaint + 1));
                    this._setTextData();
                    this._sceneFuncImpl(context, false, false);
                    this.drawunderline(0);
                }
                return;
            }
            if (sft == 5 && needToPaint < otext.length) {
                if (needToPaint > 0) {
                    this.setText(otext.substr(0, needToPaint == 1 ? 1 : (needToPaint == 2 ? 3 : needToPaint + 3)));
                    this._setTextData();
                    this._sceneFuncImpl(context, false, true);
                    this.setText(otext.substr(0, needToPaint == 1 ? 0 : needToPaint));
                    this._setTextData();
                    this._sceneFuncImpl(context, false, false);
                }
                return;
            }
            if (sft == 6 && needToPaint < otext.length) {
                if (needToPaint > 0) {
                    var pend = needToPaint == 1 ? 1 : (needToPaint == 2 ? needToPaint + 2 : needToPaint + 2);
                    var pstart = pend - 2 < 0 ? 0 : pend - 2;
                    this.setGstart(pstart);
                    this.setGend(pend);
                    this.setText(otext.substr(pstart, pend));
                    this._setTextData();
                    this._sceneFuncImpl(context, false, true);
                    this.setGstart(0);
                    this.setGend(0);
                    this.setText(otext.substr(0, needToPaint == 1 ? 0 : needToPaint));
                    this._setTextData();
                    this._sceneFuncImpl(context, false, false);
                }
                return;
            }
            var fill = this.fill(), fillBlue = this.fillBlue(), fillRed = this.fillRed(), fillGreen = this.fillGreen(), fillAlpha = this.fillAlpha(),
                stroke = this.stroke(), strokeBlue = this.strokeBlue(), strokeRed = this.strokeRed(), strokeGreen = this.strokeGreen(), strokeAlpha = this.strokeAlpha();



            if (sft == 2 && needToPaint < otext.length) {
                this.setText(otext);
                this._setTextData();
                this._sceneFuncImpl(context, true, false);
            }
            if (needToPaint > 0) {
                this.fill(fill); this.fillBlue(fillBlue); this.fillRed(fillRed); this.fillGreen(fillGreen); this.fillAlpha(fillAlpha);
                this.stroke(stroke); this.strokeBlue(strokeBlue); this.strokeRed(strokeRed); this.strokeGreen(strokeGreen); this.strokeAlpha(strokeAlpha);
                this.setText(otext.substr(0, needToPaint + 1));
                this._setTextData();
                this._sceneFuncImpl(context, false, false);
            }
        },

        _sceneFuncImpl: function (context, paintBgText, paintBorderOnly) {
            var sft = this.getSft(), lineHeightPx = this  ._getLineHeightPx(), textArr = this.textArr, textArrLen = textArr.length, totalWidth = this
                    .getWidth(), abOrder = this.abOrder(), glow = this.glow(), gstart = this.gstart(), gend = this.gend(),
                textXOffset = this.textXOffset(), textYOffset = this.textYOffset(),
                math = this.math(),
                pX = this.getPaddingX(), pY = this.getPaddingY(), n;

            this._drawBackground(context);



            var r9vstart = this.getR9vstart();
            var r9vpstart = this.getR9vpstart();

            var paintAll = this.text() == this.otext();

            if (r9vpstart >= 0) {
                r9vstart = Math.ceil(r9vpstart / lineHeightPx);
            }
            var r9vend = this.getR9vsize() <  0 ? 1000 : r9vstart + this.getR9vsize() - 1;

            context.setAttr('font', this._getContextFont());
            // context.setAttr('textAlign', LEFT);

            context.save();
            context.translate(pX, pY);

         

            if (sft == 6 && gend > 0) {
                if (gstart > 0) {
            	   var th = lineHeightPx;
                   for (n = 0; n < textArrLen; n++) {
                       var obj = textArr[n], text = obj.text, width = obj.width, style = obj.style;
                       if (style && style.math && style.math.toph) {
                           th = Math.max(th, style.math.toph);
                       }
                   }
                	
                    var offx6 = this._getTextSize(this.otext().substring(0, gstart)).width;
                    context.translate(offx6, 0);
                    context.setAttr('textBaseline', MIDDLE);
                    context.translate(0,  th / 2);
                    this.partialText = this.text();
                    context.fillShape(this);
                    context.restore();
                    return;
                }
            }

            context.setAttr('textBaseline', MIDDLE); 
            
            if (math) {
            	 context.translate(0, math.toph / 2 );
                var strokecolorStr = this.getStrokeStyle();
                r9_drawMathForm.call(this, this, math, context, strokecolorStr, { top: 0, left: 0, right: 0, bottom: 0 },
                    0, 0, this.getFontSize());
                context.restore();
                return;
            }
           

            if (abOrder) {
                var orderw = this._getTextSize(abOrder).width;
                context.setAttr("strokeStyle",this._curTextColor || this.getStrokeStyle());
                context.strokeText(abOrder, 0, 0);
                context.translate(orderw, 0);
            }

            if (sft == 4) {
                var kalaokoffset = this.kalaokoffset();
                if (kalaokoffset < 0)
                    ;
                else
                    context.translate(kalaokoffset, 0);
            }
            var _xoffset = 0;
            var rowIndex = 0;
            var newLineStart = true;
            var hasMedia = false;
            var curRowHeight = 0;
            for (n = 0; n < textArrLen; n++) {
                var obj = textArr[n], text = obj.text, width = obj.width, style = obj.style;
                this._curR9textstyle = style;
                if( style && style.itag && style.itagwidth && text == '#' )
                	text = " ";
                hasMedia = false;

                var isNewLine = text.indexOf("\n") >= 0 && sft != 4;

                if (r9vstart > rowIndex || rowIndex > r9vend) {
                    if (isNewLine) {
                        rowIndex++;
                    }
                    continue;
                }

                if (newLineStart && sft != 4) {
                    var alineH = lineHeightPx;
                    if (style && style.rh) {
                        alineH = style.rh;
                    }
                    context.translate(- _xoffset, curRowHeight/2 + alineH/2);
                    _xoffset = 0;
                    newLineStart = false;
                    curRowHeight = alineH;
                }

                if (isNewLine) newLineStart = true;

                context.save();
                context.setAttr('textBaseline', MIDDLE);
                var ccc ;
                if (paintBgText) {
                	 ccc =   this.getStrokeStyle(0.3);
                	   if (paintBorderOnly){ 
                     	  this._curTextColor = ccc;
                	   }  else {
                		   this._curTextColor = ccc;
                	   }
               } else {
                 	 var ccc = ( style && style.fct < 0  && style.stroke ) || this._defaultStroke; 
                      if( !ccc ) ccc = this.getStrokeStyle();
                      if (paintBorderOnly) 
                    	  this._curTextColor = ccc;
                 	 else 
                 		  this._curTextColor = ccc;
                 } 
                if (style) {  
                    style.width = width;
                    style.height = this._curR9textstyle.rh || lineHeightPx;

                    // this._curFontWeight = null;
                    // this._curFontStyle = null;
                    if (style.b) {
                        this._curFontWeight = "bold";
                        this._curFontStyle = null;
                    } else if (style.i) {
                        this._curFontStyle = "italic";
                        this._curFontWeight = "normal";
                    } else {
                        this._curFontWeight = "normal";
                        this._curFontStyle = null;
                    }

                    if (style.iconName) {
                        var imge = r9 && r9.getCacheImageByName(style.iconName);
                        if (imge) {
                            var iconwh = this._getTextSize("xx").width;
                            var iconxof = Math.max(0, (width - iconwh) / 2);
                            // var iconyoff = Math.abs((style.height - iconw)/2);
                            context.translate(iconxof, -iconwh / 2);
                            var params = [imge, 0, 0, 32, 32, 0, 0, iconwh, iconwh];
                            context.drawImage.apply(context, params);
                            context.translate(-iconxof, iconwh / 2);
                            hasMedia = true;
                        }
                    }
        
                    if (style.fontFamily)
                        this._curFontFamily = style.fontFamily;
                    else
                        this._curFontFamily = this.getFontFamily();
 
                    if (style.sup)
                        context.translate(0, - style.height / 3);
                    if (style.sub)
                        context.translate(0, + style.height / 3); 
                    context.setAttr('font', this._getContextFont());

                    if (style.math) {
                        width = style.math.topw;
                        var tXoff = Math.max(0, (width - style.math.topw) / 2);
                        // var tYoff = - (style.math.h - lineHeightPx) /2;
                        var tYoff =   style.math.toph / 2;
                        r9_drawMathForm.call(this, this,
                            style.math, context, ccc, { top: 0, left: 0, right: 0, bottom: 0 },
                            tXoff, 0, this.getFontSize());
                        hasMedia = true;
                    }

                    this.partialText = hasMedia ? "" : text;
                    if (paintBorderOnly) {
                        this.strokeWidth(1),
                        context.strokeShape(this);
                    } else {
                        context.fillShape(this);
                    }
                    context.restore();
                    context.lineWidth = 1;

                    if (isNewLine) { 
                        rowIndex++;
                    } else {
                        context.translate(width, 0);
                        _xoffset += width;
                    }

                } else {  // end-style  
                    if (this.getAlign() === RIGHT) {
                        context.translate(totalWidth - width - pX * 2, 0);
                    } else if (this.getAlign() === CENTER) {
                        context.translate((totalWidth - width - pX * 2) / 2, 0);
                    }
                    this._curFontFamily = this.getFontFamily();  
                    this.partialText = text; 
                    if (paintBorderOnly) {
                        this.strokeWidth(1),
                        context.strokeShape(this);
                    } else {
                        context.fillShape(this);
                    } 
                    if (isNewLine) {
                        rowIndex++;
                    }
                    context.restore();
                } 
            }
            if (!paintAll) {
                if (glow)
                    this._drawGlow(context, 0, 0);
                this._drawPenFunc(context, 0, 0);
            }
            context.restore();
            this.drawCorrectMarker(context);
            this.drawSelectionMarker(context);
 
        },

        _drawPenFunc: function (context, x, y) {
            var pen = this.penImageName();
            if (pen && pen.length > 0) {
                var imge = r9 && r9.getCacheImageByName(pen);
                if (imge) {
                    context.translate(x - imge.width / 2, y + 10);
                    var params = [imge, 0, 0, imge.width, imge.height];
                    context.drawImage.apply(context, params);
                }
            }
        },
        _drawGlow: function (context, x, y) {
            var w = this.getWidth(), h = this.getHeight();
            context.save();
            context.translate(0, -h / 2);
            var gradient4 = context.createRadialGradient(0, 0, 0, 0, 0, h / 2);
            gradient4.addColorStop(0, 'rgba(255,0,0, 0.6)');
            gradient4.addColorStop(1, 'rgba(255,0,0,0)');
            context.fillStyle = gradient4;// "rgba(255,0,0, 0.2)" ;
            context.setAttr('fillStyle', gradient4);// "rgba(255,0,0, 0.2)");
            context.beginPath();
            context.arc(0, 0, h / 2, 0, Math.PI * 2, false);
            context.closePath();
            context.fill();
            context.restore();
        },
        _hitFunc: function (context) {
            var width = this.getWidth(), height = this.getHeight();

            context.globalAlpha = 0.5;
            context.beginPath();
            context.rect(0, 0, width, height);
            context._context.fillStyle = 'yellow';
            context.fillStrokeShape(this);

        },
        setText: function (text) { 
            var str = !!text ? (Kinetic.Util._isString(text) ? text : text.toString()) : '';
            this._setAttr(TEXT, str);
            return this;
        },
        getPaddingX: function () {
            return this.getPadding() + this.textXOffset();
        },
        getPaddingY: function () {
            return this.getPadding() + this.textYOffset();
        },
        getWidth: function () {
            return this.attrs.width === AUTO ? this.getTextWidth()
                + this.getPaddingX() * 2 : this.attrs.width;
        },

        getHeight: function () {
            if (this.attrs.height === AUTO) {
                if ( this.textHeight ) {
                	  return this.textHeight + this.getPaddingY() * 2; 
                } else {
                	 return (  this.textArr.length * this.getLineHeight())
                     + this.getPaddingY() * 2;
                }
            } else {
                return this.attrs.height;
            }

        },

        getTextWidth: function () {
            return this.textWidth;
        },

        getTextHeight: function () {
            return this.textHeight;
        },
        _getTextSize: function (text, r9textstyle) {
            var _context = dummyContext, fontSize = this.getFontSize(), metrics;
            if (typeof r9textstyle != "undefined" ){
            	if(   r9textstyle.math)  
                    return {
                      width: parseInt(r9textstyle.math.topw, 10),
                      height: parseInt(r9textstyle.math.toph, 10)
                   };
                 if(  r9textstyle.itag && r9textstyle.itagwidth )
                	 return { 
                	    width: parseInt(r9textstyle.itagwidth, 10),
                        height: parseInt(fontSize, 10)
                    };
            } 
            _context.save();
            _context.font = this._getContextFont();

            metrics = _context.measureText(text);
            _context.restore();
            return {
                width: metrics.width,
                height: parseInt(fontSize, 10)
            };
        },
        _getContextFont: function (fontsize, fontFamily) {
            return this._getFontStyle() + SPACE + this.getFontVariant() + SPACE + this._getFontWeight() + SPACE
                + (typeof fontsize == 'undefined' ? this.getFontSize() : fontsize) + PX_SPACE
                + (typeof fontFamily == 'undefined' ? this.fontFamily() : fontFamily);
        },
        _getFontWeight: function () {
            if (this._curFontWeight)
                return this._curFontWeight;
            else
                return this.getFontWeight();
        },
        _getFontStyle: function () {
            if (this._curFontStyle) {
                var style = this._curFontStyle;
                if (style === "bold") {
                    _curFontWeight = "bold";
                    return "normal";
                }
                return this._curFontStyle;
            } else
                var style = this.getFontStyle();
            if (style === "bold") {
                _curFontWeight = "bold";
                return "normal";
            }
            return style;
        },
        _getFontFamily: function () {
            if (this._curFontFamily)
                return this._curFontFamily;
            else
                return this.getFontFamily();
        },
        _getLineHeightPx: function (r9textstyle) {
            if (r9textstyle && r9textstyle.rh) {
                return r9textstyle.rh;
            } else if (this.getR9lineHeight() < 0) {
                return this.getLineHeight() * this.getFontSize();
            } else
                return this.getR9lineHeight();
        },

        _addTextLine: function (line, width, r9textstyle) {
            return this.textArr.push({
                text: line,
                width: width,
                style: r9textstyle
            });
        },
        _getTextWidth: function (text) {
            return dummyContext.measureText(text).width;
        },
        _setTextData: function () {
            try {
                if (this.r9textstyle() && this.r9textstyle().length > 0) {
                    return this._setTextData2();
                } else {
                    return this._setTextData1();
                }
            } catch (e) {
                r9_log_console(e);
                return this._setTextData1();
            }
        },
        _setTextData1: function () {
            var lines = this.getText().split('\n'), fontSize = this
                .getFontSize(), textWidth = 0, lineHeightPx = this
                    ._getLineHeightPx(), width = this.attrs.width, height = this.attrs.height,
                    textXOffset = this.textXOffset(), textYOffset = this.textYOffset(),
                    //we have some issue when textoffset is not zero, to calculated wrapped size. 
                    fixedWidth = width !== AUTO  && textXOffset == 0,    
                    fixedHeight = height !== AUTO && textYOffset == 0,
                   paddingX = this  .getPaddingX(), paddingY = this.getPaddingY() ;
            var maxWidth = fixedWidth ?   10000 : width - paddingX * 2 ,
            		maxHeightPx = fixedHeight ? 10000 : height  - paddingY * 2 , 
            		currentHeightPx = 0, wrap = this.getWrap(), shouldWrap = wrap !== NONE, wrapAtWord = wrap !== CHAR
                    && shouldWrap, sft = this.getSft(), needToPaint = this.needToPaint();

            this.textArr = [];
            dummyContext.save();
            dummyContext.font = this._getContextFont(); 
            for (var i = 0, max = lines.length; i < max; ++i) {
                var line = lines[i], lineWidth = this._getTextWidth(line);
                if (fixedWidth && lineWidth > maxWidth) {

                    while (line.length > 0) {
                        var low = 0, high = line.length, match = '', matchWidth = 0;
                        while (low < high) {
                            var mid = (low + high) >>> 1, substr = line.slice(
                                0, mid + 1), substrWidth = this
                                    ._getTextWidth(substr);
                            if (substrWidth <= maxWidth) {
                                low = mid + 1;
                                match = substr;
                                matchWidth = substrWidth;
                            } else {
                                high = mid;
                            }
                        }

                        if (match) { 
                            if (wrapAtWord) { 
                                var wrapIndex = Math.max(match
                                    .lastIndexOf(SPACE), match
                                        .lastIndexOf(DASH)) + 1;
                                if (wrapIndex > 0) { 
                                    low = wrapIndex;
                                    match = match.slice(0, low);
                                    matchWidth = this._getTextWidth(match);
                                }
                            }
                            this._addTextLine(match, matchWidth);
                            textWidth = Math.max(textWidth, matchWidth);
                            currentHeightPx += lineHeightPx;
                            if (!shouldWrap
                                || (fixedHeight && currentHeightPx
                                    + lineHeightPx > maxHeightPx)) { 
                                break;
                            }
                            line = line.slice(low);
                            if (line.length > 0) { 
                                lineWidth = this._getTextWidth(line);
                                if (lineWidth <= maxWidth) { 
                                    this._addTextLine(line, lineWidth);
                                    currentHeightPx += lineHeightPx;
                                    textWidth = Math.max(textWidth, lineWidth);
                                    break;
                                }
                            }
                        } else { 
                            break;
                        }
                    }
                } else {

                    this._addTextLine(line + "\n", lineWidth);
                    currentHeightPx += lineHeightPx;
                    textWidth = Math.max(textWidth, lineWidth);
                }

                if (fixedHeight && currentHeightPx + lineHeightPx > maxHeightPx) {
                    break;
                }
            }
            dummyContext.restore();
            this.textHeight = currentHeightPx || lineHeightPx ;
            this.textWidth = textWidth || lineWidth; 
            var abOrder = this.abOrder();
            if (abOrder) {
                var orderw = this._getTextSize(abOrder).width;
                this.textWidth += orderw;
            }
        },

        _setTextData2: function () {
            var text = this.getText(), sft = this.getSft(), r9textstyle = this.r9textstyle(), fontSize = +this
                .getFontSize(), textWidth = 0, lineHeightPx = this ._getLineHeightPx(),   
                fixedWidth = this.attrs.width !== AUTO, fixedHeight = this.attrs.height !== AUTO, 
                paddingX = this .getPaddingX(), paddingY = this.getPaddingY(), 
                textXOffset = this.textXOffset(), textYOffset = this.textYOffset();

            var  currentHeightPx = 0, wrap = this.getWrap(), shouldWrap = wrap !== NONE, wrapAtWord = wrap !== CHAR
                    && shouldWrap;

            this.textArr = [];
            dummyContext.save();
            dummyContext.font = this._getContextFont();
            var lineWidth = 0;
            currentHeightPx = 0;
            var isNewLine = true;
            for (var i = 0; i < r9textstyle.length; i++) {

                var line = r9textstyle[i].end < text.length - 1 ? text.substring(r9textstyle[i].start, r9textstyle[i].end + 1) : text.substring(r9textstyle[i].start);
                if (isNewLine) {
                    isNewLine = false;
                    currentHeightPx += this._getLineHeightPx(r9textstyle[i]);
                }


                if (r9textstyle[i].b)
                    this._curFontStyle = "bold";
                else if (r9textstyle[i].i)
                    this._curFontStyle = "italic";
                else
                    this._curFontStyle = null;

                if (r9textstyle[i].fontFamily)
                    this._curFontFamily = r9textstyle[i].fontFamily;
                else
                    this._curFontFamily = this.getFontFamily();

                var textSize = this._getTextSize(line, r9textstyle[i]);
                lineWidth += textSize.width;

                this._addTextLine(line, textSize.width, r9textstyle[i]);
                textWidth = Math.max(textWidth, lineWidth);
                if (line.indexOf("\n") >= 0 && sft != 4) {
                    lineWidth = 0;
                    isNewLine = true;
                }
            }
            dummyContext.restore();
            this.textHeight = currentHeightPx;
            this.textWidth = textWidth;
            var abOrder = this.abOrder();
            if (abOrder) {
                var orderw = this._getTextSize(abOrder).width;
                this.textWidth += orderw;
            }
        }
    };

    Kinetic.Util.extend(Kinetic.R9Text, Kinetic.Shape);


    Kinetic.Factory.addGetterSetter(Kinetic.R9Text, 'fontFamily', r9_global_font);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Text, 'fontSize', 18);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Text, 'r9lineHeight', -1);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Text, 'fontStyle', NORMAL);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Text, 'fontWeight', NORMAL);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Text, 'fontVariant', NORMAL);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Text, 'padding', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Text, 'align', LEFT);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Text, 'lineHeight', 1);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Text, 'wrap', WORD);
    Kinetic.Factory.addGetter(Kinetic.R9Text, 'text', EMPTY_STRING);
    Kinetic.Factory.addOverloadedGetterSetter(Kinetic.R9Text, 'text');
    
    //Kinetic.Factory.addGetterSetter(Kinetic.Shape, 'bgRed', 0, Kinetic.Validators.RGBComponent);
    //Kinetic.Factory.addGetterSetter(Kinetic.Shape, 'bgGreen', 0, Kinetic.Validators.RGBComponent);
    //Kinetic.Factory.addGetterSetter(Kinetic.Shape, 'bgBlue', 0, Kinetic.Validators.RGBComponent);
    //Kinetic.Factory.addGetterSetter(Kinetic.Shape, 'bgAlpha', 0, Kinetic.Validators.RGBComponent);
    

    Kinetic.Factory.addGetterSetter(Kinetic.R9Text, 'r9textstyle', '');
    Kinetic.Factory.addGetterSetter(Kinetic.R9Text, 'otext', '');
    Kinetic.Factory.addGetterSetter(Kinetic.R9Text, 'duration', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Text, 'resumeAnimation', 1);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Text, 'r9stdsize', -1);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Text, 'r9stdline', '');
    Kinetic.Factory.addGetterSetter(Kinetic.R9Text, 'r9vstart', -1);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Text, 'r9vsize', -1);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Text, 'r9vpstart', -1); 
    Kinetic.Factory.addGetterSetter(Kinetic.R9Text, 'sft', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Text, 'needToPaint', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Text, 'drawunderline', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Text, 'expression', '');
    Kinetic.Factory.addGetterSetter(Kinetic.R9Text, 'math', '');
    Kinetic.Factory.addGetterSetter(Kinetic.R9Text, 'penImageName', '');
    Kinetic.Factory.addGetterSetter(Kinetic.R9Text, 'borderType', 'None');
    Kinetic.Factory.addGetterSetter(Kinetic.R9Text, 'lineBorderType', 'Single'); 
    Kinetic.Factory.addGetterSetter(Kinetic.R9Text, 'fixed', 2);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Text, 'kalaokoffset', 9999);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Text, 'kalaoktextwidth', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Text, 'kalaokwidth', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Text, 'userobj', null);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Text, 'abOrder', '');
    Kinetic.Factory.addGetterSetter(Kinetic.R9Text, 'mstyles', null);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Text, 'useBackground', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Text, 'corner', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Text, 'borderWidth', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Text, 'textXOffset', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Text, 'textYOffset', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Text, 'borderColorStr', '');
    
    Kinetic.Factory.addGetterSetter(Kinetic.R9Text, 'glow', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Text, 'gstart', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Text, 'gend', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Text, 'effectColorStr', '');

    //r9vpstart is scrolling distance from top, r9vpx is the top-x position of viewport in global view, r9vpsize is the height of viewport
    Kinetic.R9Text.prototype.setScrollViewport = function (r9vpstart,  r9vpheight) {
    	 this.setR9vpstart(r9vpstart); 
    	 this.setR9vsize( r9vpheight / this. _getLineHeightPx() );
    };
    
    Kinetic.R9Text.prototype.relayout = function (width, height) {
    	if (!this.textHeight ) {
    		this._setTextData();
    	};
    	var padding = this.padding(), offsetx =  (width - this.textWidth - padding*2) / 2,
    	offsety = (height - this.textHeight - padding*2) / 2;
    	if( offsetx < 0 || offsety < 0 ) return;
    	this.setTextXOffset( offsetx );
    	this.setTextYOffset( offsety );
        this.setWidth(width);
        this.setHeight(height);
    };
    Kinetic.R9Text.prototype.resetOffset = function (offsetx, offsety) {
    	if (this.textHeight <= 0) {
    		this._setTextData();
    	}
    	var padding = this.padding(), w =    this.textWidth + padding*2 + offsetx*2,
    	h = this.textHeight + padding*2 + offsety*2;
     	this.setTextXOffset( offsetx );
    	this.setTextYOffset( offsety );
        this.setWidth(w);
        this.setHeight(h);
    };
    Kinetic.R9Text.prototype.changeStyle = function (styleName) {
        var mstyles = this.mstyles();
        if (typeof mstyles == 'undefined')
            return;
        for (var i in mstyles) {
            if (_r9norm(mstyles[i].name) == _r9norm(styleName)) {
                this.r9textstyle(mstyles[i].style);
                this.otext(_r9norm(mstyles[i].text));
                this.text(_r9norm(mstyles[i].text));
                break;
            }
        }
    };
    Kinetic.R9Text.prototype.changeText = function (text, styles) {
    	 this.r9textstyle(styles? styles : null);
    	 this.otext( text );
    	 this.text( text ); 
    	 this._setTextData();
    	 this.relayout(this.width(), this.height());
    };
    
    Kinetic.R9Text.prototype.toggleUnderline = function () {
        this.drawunderline() ? this.drawunderline(0) : this.drawunderline(1);
    };
    // hasTextBase is an object : {text, math, style}
    Kinetic.R9Text.prototype.setHasTextBase = function (hasTextBase) {
        this.setMath(hasTextBase.math);
        this.r9textstyle(hasTextBase.style);
        this.otext(_r9norm(hasTextBase.text));
        this.text(_r9norm(hasTextBase.text));
    };
    Kinetic.R9Text.prototype.getMathInput = function () {
    	var m = this.math();
    	if( m ) return m;
        var r9textstyle = this.r9textstyle();
        if (r9textstyle && r9textstyle.length == 2 && r9textstyle[1].math)
            return r9textstyle[1].math;
        if (r9textstyle && r9textstyle.length == 1 && r9textstyle[0].math)
            return r9textstyle[0].math;
        return null;
    };
    Kinetic.R9Text.prototype.progress = function (progress) {
        var duration = this.duration(), otext = this.otext(), sft = this.getSft();
        var total = otext.length;
        if (sft == 4) {
            var width = this.kalaokwidth() || this.getWidth();
            var fullTextWidth = this.kalaoktextwidth();
            if (fullTextWidth == 0) {
                this.setText(otext);
                this._setTextData();
                fullTextWidth = this.textWidth;
                this.kalaoktextwidth(fullTextWidth);
            }
            var kalaokoffset = duration ? width - (fullTextWidth + width) * progress : 0;
            this.kalaokoffset(kalaokoffset);
        } else {
            var needToPaint = duration ? Math.ceil(total * progress) : total;
            this.needToPaint(needToPaint);
        }

    };

    Kinetic.Collection.mapMethods(Kinetic.R9Text);
})();
;

(function () {


    Kinetic.SImage = function (config) {
        this.___init(config);
    };

    Kinetic.SImage.prototype = {
        ___init: function (config) {

            Kinetic.Shape.call(this, config);
            this.className = 'SImage';
            this.sceneFunc(this._sceneFunc);
            this.hitFunc(this._hitFunc);
        },
        _useBufferCanvas: function () {
            return (this.hasShadow() || this.getAbsoluteOpacity() !== 1) && this.hasStroke() && this.getStage();
        },
        _sceneFunc: function (context) {
            var width = this.getWidth(),
                height = this.getHeight(),
                image = this.getImage(),
                cropWidth, cropHeight, params, ratioX, ratioY, r9cropX,
                r9cropY, r9cropWidth, r9cropHeight;

            if (image) {
                cropWidth = this.getCropWidth();
                cropHeight = this.getCropHeight();
                ratioX = this.getImageRatioX();
                ratioY = this.getImageRatioY();
                r9cropX = this.getR9cropX();
                r9cropY = this.getR9cropY();
                r9cropWidth = this.getR9cropWidth();
                r9cropHeight = this.getR9cropHeight();

                if (r9cropWidth && r9cropHeight) {
                    params = [image, r9cropX * ratioX, r9cropY * ratioY, r9cropWidth * ratioX, r9cropHeight * ratioY, 0, 0, width, height];
                } else if (cropWidth && cropHeight) {
                    params = [image, this.getCropX() * ratioX, this.getCropY() * ratioY, cropWidth * ratioX, cropHeight * ratioY, this.getCropX(), this.getCropY(), cropWidth, cropHeight];
                } else {
                    params = [image, 0, 0, width, height];
                }
            }

            if (this.strokeWidth() > 0) {
                context.beginPath();
                context.rect(0, 0, width, height);
                context.closePath();
                context.fillStrokeShape(this);
            }

            if (image) {
                context.drawImage.apply(context, params);
            }

            this.drawCorrectMarker(context);

            this.drawSelectionMarker(context);
        },
        _hitFunc: function (context) {
            var width = this.getWidth(),
                height = this.getHeight(), x = 0, y = 0; //, x = this.getCropX() | this.getX(), y = this.getCropY() | this.getY();

            context.beginPath();
            context.rect(x, y, width, height);
            context.closePath();
            context.fillStrokeShape(this);


        },
        getImageWidth: function () {
            var image = this.getImage();
            return this.attrs.width || (image ? image.width : 0);
        },
        getImageHeight: function () {
            var image = this.getImage();
            return this.attrs.height || (image ? image.height : 0);
        },
        getWidth: function () {
            var cropWidth = this.getCropWidth();
            if (cropWidth)
                return cropWidth;
            else
                return this.getImageWidth();
        },
        getHeight: function () {
            var cropHeight = this.getCropHeight();
            if (cropHeight)
                return cropHeight;
            else
                return this.getImageHeight();
        },
        getImageRatioX: function () {
            var image = this.getImage();
            if (!image) return 1;
            var simageWidth = this.attrs.width;
            if (!simageWidth) return 1;
            return image.width / simageWidth;
        },
        getImageRatioY: function () {
            var image = this.getImage();
            if (!image) return 1;
            var simageHeight = this.attrs.height;
            if (!simageHeight) return 1;
            return image.height / simageHeight;

        }

    };
    Kinetic.Util.extend(Kinetic.SImage, Kinetic.Shape);


    Kinetic.Factory.addGetterSetter(Kinetic.SImage, 'image');
    Kinetic.Factory.addGetterSetter(Kinetic.SImage, 'duration', 0);

    Kinetic.Factory.addComponentsGetterSetter(Kinetic.SImage, 'crop', ['x', 'y', 'width', 'height']);

    Kinetic.Factory.addGetterSetter(Kinetic.SImage, 'cropX', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.SImage, 'cropY', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.SImage, 'cropWidth', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.SImage, 'cropHeight', 0);

    Kinetic.Factory.addComponentsGetterSetter(Kinetic.SImage, 'r9crop', ['x', 'y', 'width', 'height']);
    Kinetic.Factory.addGetterSetter(Kinetic.SImage, 'r9cropX', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.SImage, 'r9cropY', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.SImage, 'r9cropWidth', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.SImage, 'r9cropHeight', 0);

    Kinetic.Factory.addComponentsGetterSetter(Kinetic.SImage, 'fcrop', ['x', 'y', 'width', 'height']);
    Kinetic.Factory.addGetterSetter(Kinetic.SImage, 'fcropX', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.SImage, 'fcropY', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.SImage, 'fcropWidth', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.SImage, 'fcropHeight', 0);


    Kinetic.Factory.addComponentsGetterSetter(Kinetic.SImage, 'tcrop', ['x', 'y', 'width', 'height']);
    Kinetic.Factory.addGetterSetter(Kinetic.SImage, 'tcropX', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.SImage, 'tcropY', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.SImage, 'tcropWidth', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.SImage, 'tcropHeight', 0);



    Kinetic.SImage.prototype.progress = function (progress, dur) {
        if (dur == 0) return;
        var width = this.getWidth(),
            height = this.getHeight(),
            fcropX = this.fcropX(), fcropY = this.fcropY(),
            fcropWidth = this.fcropWidth() || width, fcropHeight = this.fcropHeight() || height,
            tcropX = this.tcropX(), tcropY = this.tcropY(),
            tcropWidth = this.tcropWidth() || width, tcropHeight = this.tcropHeight() || height;
        if (fcropWidth === tcropWidth && fcropHeight === tcropHeight)
            return;
        this.r9crop({
            x: fcropX + (tcropX - fcropX) * progress,
            y: fcropY + (tcropY - fcropY) * progress,
            width: fcropWidth + (tcropWidth - fcropWidth) * progress,
            height: fcropHeight + (tcropHeight - fcropHeight) * progress
        });

    };

    Kinetic.SImage.prototype.changeCrop = function (cx, cy, cw, ch) {
        var tcropX = this.tcropX(), tcropY = this.tcropY(),
            tcropWidth = this.tcropWidth(), tcropHeight = this.tcropHeight();

        this.tcrop({ x: cx, y: cy, width: cw, height: ch });


        if (tcropWidth === 0 || tcropHeight === 0) {
        } else {
            this.fcrop({ x: tcropX, y: tcropY, width: tcropWidth, height: tcropHeight });
        }


    };
    Kinetic.SImage.prototype.setState = function (state) {
        this.state = state;
        if (state === this.state1) { this.image = this.image1; }
        if (state === this.state2) { this.image = this.image2; }
    };

    Kinetic.SImage.prototype.setTwoStates = function (state1, image1, func1, state2, image2, func2) {
        this.state1 = state1;
        this.image1 = image1;
        this.func1 = func1;
        this.state2 = state2;
        this.image2 = image2;
        this.func2 = func2;
        this.setState(state1);
        this.on('tap click', function () {
            if (this.state == this.state1) { this.func1(); this.setState(this.state2); };
            if (this.state == this.state2) { this.func2(); this.setState(this.state1); }
        });
    };

    Kinetic.Collection.mapMethods(Kinetic.SImage);

})();

;
(function () {
    var dummyContext = Kinetic.Util.createCanvasElement().getContext('2d');

    Kinetic.SShapeText = function (config) {
        this.___init(config);
    };

    Kinetic.SShapeText.prototype = {
        ___init: function (config) {
            Kinetic.Shape.call(this, config);
            this.className = 'SShapeText';
            this.cloudArray = [];
            if (this.borderType() == 'Cloud')
                this.cloudArray = Kinetic.Util.parsePathData(r9_cloud);
            var eventtype = this.getEventtype() ,name = this.getName(), value = this.getValue();
            if (eventtype) {
               // this.off('click tap');
                this.cleanon('click tap', function () { r9.PageBus.publish(eventtype, { 'name': name, 'value': value }); });
            }
            this.sceneFunc(this._sceneFunc);
            this.hitFunc(this._hitFunc);
        },

        _getContextFont: function (fontsize, fontFamily) {
            var PX_SPACE = 'px ', SPACE = ' ';
            return this.getFontStyle() + SPACE + this.getFontVariant() + SPACE + this.getFontWeight() + SPACE
                + (typeof fontsize == 'undefined' ? this.getFontSize() : fontsize) + PX_SPACE +
                (typeof fontFamily == 'undefined' ? this.getFontFamily() : fontFamily);
        },
        _hitFunc: function (context) {
            var width = this.getWidth(), height = this.getHeight();
            context.beginPath();
            context.rect(0, 0, width, height);
            context.closePath();
            context.fillStrokeShape(this);
        },

        _sceneFunc: function (context) {
            var cornerRadius = this.getCornerRadius(),
                width = this.getWidth(),
                height = this.getHeight(),
                name = this.getName(),
                value = this.getValue(),
                tXoff = this.getTextXOffset(),
                tYoff = this.getTextYOffset(),
                fontColorStr = this.getFontColorStr(),
                borderColorStr = this.getBorderColorStr(),
                iconName = this.getIconName(),
        //        useUnderline = this.getUseUnderline(),
                eventtype = this.getEventtype(),
                borderWidth = this.getBorderWidth(),
                borderType = this.borderType(),
                math = this.getMath(); 
 
            if (iconName) { width += 32; }
            context.save();
            context.beginPath();

            if (borderColorStr) {
                context.setAttr('strokeStyle', borderColorStr);
                context.setAttr('lineWidth', borderWidth);
            }
            if ( borderType == 'Cloud') {
                var scaleX = width / 250.0, scaleY = height / 100.0;
                context.scale(scaleX, scaleY);
                Kinetic.Util.drawPathByData(this, context, this.cloudArray, false);
                context.scale(1 / scaleX, 1 / scaleY);
            }
            else if (borderType == 'Underline') {
                context.rect(0, height - this.getStrokeWidth(), width, this.getStrokeWidth());
                context.closePath();
            } else {
                if (!cornerRadius) {
                    context.rect(0, 0, width, height);
                    context.closePath();
                }
                else {
                	 r9_drawRounded.call(this,context, 0, 0, width, height, cornerRadius);
                }
            }
            context.fillStrokeShape(this);
            context.restore();

            if (iconName) {

                var imge = r9 && r9.getCacheImageByName(iconName);
                if (imge) {
                    var params = [imge, tXoff, tYoff, 24, 24];
                    context.drawImage.apply(context, params);
                    tXoff += 28;
                }

            }


            context.save();
            context._context.font = this._getContextFont();

            context.setAttr('font', this._getContextFont());




            if (math != null) { //&& (typeof mathInput.render != 'undefined') ) {
                //use fontSize to approximate text height? FIXME
                r9_drawMathForm.call(this, this,
                		math, context, fontColorStr, { top: 0, left: 0, right: 0, bottom: 0 },
                    tXoff, tYoff + Math.max(0, (height - math.toph) / 2) + this.getFontSize(),
                    this.getFontSize());

            } else {
                // context.setAttr('textBaseline', 'middle');
                if (fontColorStr) {
                    context.setAttr('fillStyle', fontColorStr);
                    context.setAttr('strokeStyle', fontColorStr);
                }
                var lineHeight = getFontHeight(null, this.getFontStyle(), this.getFontSize(), this.getFontFamily());
                // this.getLineHeight() * this.getFontSize();
                var lines = name.split('\n')
                tYoff = (height - lines.length * lineHeight) / 2
                context._context.textBaseline = "top";
                context.beginPath();

                for (var i = 0, max = lines.length; i < max; ++i) {
                    var line = lines[i];
                    context.fillText(line, tXoff, tYoff);
                    tYoff += lineHeight;
                }
                context.closePath();
                context.fillStrokeShape(this);
            }



            context.restore();
            this.drawCorrectMarker(context);
            this.drawSelectionMarker(context);

        }
    };
    Kinetic.SShapeText.prototype.resetText = function (text) {
        dummyContext.font = this._getContextFont();
        var cloudAdust = this.borderType() == 'Cloud' ? 50 : 0;
        var tsize = dummyContext.measureText(text).width,
            width = this.width(), height = this.height();
        if (width >= tsize + cloudAdust) {
            this.textXOffset((width - tsize - cloudAdust) / 2);
        } else {
            this.width(tsize + cloudAdust + 10);
            this.x(this.x() - (tsize + cloudAdust - width) / 2 - 5);
            this.textXOffset(5);
        }
        tsize = this.getLineHeight() * this.getFontSize();
        if (height >= tsize + cloudAdust) {
            this.textYOffset((height - tsize - cloudAdust) / 2);
        } else {
            this.height(tsize + cloudAdust + 10);
            this.y(this.y() - (tsize + cloudAdust - height) / 2 - 5);
            this.textYOffset(5);
        }

        this.name(text);
    }

    Kinetic.Util.extend(Kinetic.SShapeText, Kinetic.Shape);
    Kinetic.Factory.addGetterSetter(Kinetic.SShapeText, 'fontColorStr', '');
    Kinetic.Factory.addGetterSetter(Kinetic.SShapeText, 'borderColorStr', '');
    Kinetic.Factory.addGetterSetter(Kinetic.SShapeText, 'cornerRadius', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.SShapeText, 'name', '');
    Kinetic.Factory.addGetterSetter(Kinetic.SShapeText, 'value', '');
    Kinetic.Factory.addGetterSetter(Kinetic.SShapeText, 'id', '');
    Kinetic.Factory.addGetterSetter(Kinetic.SShapeText, 'eventtype', '');
    Kinetic.Factory.addGetterSetter(Kinetic.SShapeText, 'fontFamily', r9_global_font);
    Kinetic.Factory.addGetterSetter(Kinetic.SShapeText, 'fontSize', 18);
    Kinetic.Factory.addGetterSetter(Kinetic.SShapeText, 'lineHeight', 1);
    Kinetic.Factory.addGetterSetter(Kinetic.SShapeText, 'borderWidth', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.SShapeText, 'fontStyle', 'normal');
    Kinetic.Factory.addGetterSetter(Kinetic.SShapeText, 'fontVariant', 'normal');
    Kinetic.Factory.addGetterSetter(Kinetic.SShapeText, 'fontWeight', 'normal');
    Kinetic.Factory.addGetterSetter(Kinetic.SShapeText, 'padding', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.SShapeText, 'align', 'left');
    Kinetic.Factory.addGetterSetter(Kinetic.SShapeText, 'textXOffset', 5);
    Kinetic.Factory.addGetterSetter(Kinetic.SShapeText, 'textYOffset', 5);

    Kinetic.Factory.addGetterSetter(Kinetic.SShapeText, 'iconName', '');
 //   Kinetic.Factory.addGetterSetter(Kinetic.SShapeText, 'useUnderline', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.SShapeText, 'borderType', 'Normal');
    Kinetic.Factory.addGetterSetter(Kinetic.SShapeText, 'math', null);

    Kinetic.Collection.mapMethods(Kinetic.SShapeText);
})();

;
(function () {

    Kinetic.STextInput = function (config) {
        this.___init(config);
    };

    Kinetic.STextInput.prototype = {
        ___init: function (config) {
            Kinetic.Shape.call(this, config);
            this.className = 'STextInput';
            this.sceneFunc(this._sceneFunc);
            this.hitFunc(this._hitFunc);
        },

        _getContextFont: function (fontsize, fontFamily) {
            var PX_SPACE = 'px ', SPACE = ' ';
            return this.getFontStyle() + SPACE + this.getFontVariant() + SPACE
                + (typeof fontsize == 'undefined' ? this.getFontSize() : fontsize) + PX_SPACE
                + (typeof fontFamily == 'undefined' ? this.getFontFamily() : fontFamily);
        },

        _hitFunc: function (context) {
            var width = this.getWidth(), height = this.getHeight();
            context.beginPath();
            context.rect(0, 0, width, height);
            context.closePath();
            context.fillStrokeShape(this);
        },

        _sceneFunc: function (context) {
            var cornerRadius = this.getCornerRadius(),
                width = this.getWidth(),
                height = this.getHeight(),
                text = this.getText(),
                answers = this.getAnswers(),
                valid = this.valid(),
                pack = this.getPack(),
                placeholder = this.getPlaceholder(),
                useUnderline = this.getUseUnderline(),
                math = this.getMath(),
                fontSize = this.getFontSize();
 

            context.setAttr('font', this._getContextFont(fontSize));
             context.setAttr('textBaseline', 'middle');
            //context.setAttr('textAlign', 'left');
            if (text) {
                m = context._context.measureText(text);
            } else if (placeholder) {
                m = context._context.measureText(placeholder);
            }
            if (pack) {
                width = m.width + 6;
            }

            context.beginPath();

            if (useUnderline == 1) {
                context.moveTo(0, height);
                context.lineTo(width, height);
            } else if (!cornerRadius) {
                context.rect(0, 0, width, height);
                context.closePath();
            }
            else {
            	 r9_drawRounded.call(this,context, 0, 0, width, height, cornerRadius);
            }

            context.fillStrokeShape(this);


            if (!valid) {
                context.setAttr('fillStyle', 'rgba(255,88,51,0.1)');
                context.setAttr('strokeStyle', 'rgba(255,88,51,1)');
            }

            var lineHeight =  getFontHeight(null, this.getFontStyle(), this.getFontSize(), this.getFontFamily()); 
            var yoffset =  height/2;

            if (math != null) {//} && (typeof mathInput.render != 'undefined') ) {
                var textColor = this.textColor();
                r9_drawMathForm.call(this, this, math, context, textColor,
                    { top: 0, left: 0, bottom: 0, right: 0 },
                    0,
                    yoffset,
                    fontSize);
            }
            else if (text) {
                this.drawTextString(context, text, Math.max(0, (width - m.width) / 2), yoffset, lineHeight);
            } else if (placeholder) {
                this.drawTextString(context, placeholder, 0, yoffset, lineHeight);
            }
           // yoffset += lineHeight;
            //if (!valid) {  //where is key?
            //    context.setAttr('strokeStyle', 'rgba(255,88,51,1)');
            //    this.drawTextString(context, key, 0, yoffset + 5, lineHeight);
           // }

            this.drawSelectionMarker(context); 
        }
    };
    Kinetic.STextInput.prototype.drawTextString = function (context, text, x, y, lineHeight) {
        var textColor = this.textColor();
        var strike = false;
        context.setAttr('font', this._getContextFont());
        context.setAttr('fillStyle', textColor);
        context.setAttr('strokeStyle', textColor);

        for (var i = 0; i < text.length; i++) {
            //check <sup>
            if (text.charAt(i) == '<' && text.charAt(i + 1) == 's' && text.charAt(i + 2) == 'u' && text.charAt(i + 3) == 'p' && text.charAt(i + 4) == '>') {
                y = y - lineHeight / 3;
                i = i + 4; continue;
            }
            if (text.charAt(i) == '<' && text.charAt(i + 1) == '/' && text.charAt(i + 2) == 's' && text.charAt(i + 3) == 'u' && text.charAt(i + 4) == 'p' && text.charAt(i + 5) == '>') {
                y = y + lineHeight / 3;
                i = i + 5; continue;
            }
            if (text.charAt(i) == '<' && text.charAt(i + 1) == 's' && text.charAt(i + 2) == 'u' && text.charAt(i + 3) == 'b' && text.charAt(i + 4) == '>') {
                y = y + lineHeight / 3;
                i = i + 4; continue;
            }
            if (text.charAt(i) == '<' && text.charAt(i + 1) == '/' && text.charAt(i + 2) == 's' && text.charAt(i + 3) == 'u' && text.charAt(i + 4) == 'b' && text.charAt(i + 5) == '>') {
                y = y - lineHeight / 3;
                i = i + 5; continue;
            }
            if (text.charAt(i) == '√' && text.charAt(i + 1) == ')') {
                strike = false;
                i = i + 1; continue;
            }

            context.fillText(text.charAt(i), x, y);
            var m = context._context.measureText(text.charAt(i));
            if (strike) { context.save(); context.beginPath(); context.moveTo(x, y - lineHeight * 4 / 5); context.lineTo(x + m.width, y - lineHeight * 4 / 5); context.closePath(); context.fillStrokeShape(this); context.restore(); }
            x = x + m.width;

            if (text.charAt(i) == '√' && text.charAt(i + 1) != ')') {
                strike = true;
            }

        }
    };
    
    Kinetic.STextInput.prototype.validating = function () {
        var text = this.getText(), answers = this.getAnswers(),
        math = this.getMath();
        // this.setValidate(1);
        if ( math  ) {
            text = math.toString();
        }
        
        for (var i in answers) {
        	var a = answers[i].toString();
            if (a == text) {
                return true;
            }
	     	 if (a.indexOf("...") > 0) {
	             var fs = a.split("...");
	             if (fs.length == 2 && fs[0].length > 0 && fs[1].length > 0) {
	                 try { if (parseFloat(fs[0]) <= parseFloat(text) && parseFloat(fs[1]) >= parseFloat(text)) { return true; } } catch (e) { r9_log_console(e); }
	             }
	         } 
        }
        return false;
    };
    Kinetic.STextInput.prototype.del = function () {
        var text = this.getText(), feedback = _r9norm(this.correctStr()),
        math = this.getMath(), linkedvarid = this.getLinkedvarid();
        if (math) {
            this.setText('');
            this.setMath(null);
        }
        else if (text && text.length > 1) {
            if (text.indexOf('<sup>', text.length - '<sup>'.length) !== -1) { text = text.substring(0, text.length - '<sup>'.length); }
            else if (text.indexOf('</sup>', text.length - '</sup>'.length) !== -1) { text = text.substring(0, text.length - '</sup>'.length); }
            else if (text.indexOf('<sub>', text.length - '<sub>'.length) !== -1) { text = text.substring(0, text.length - '<sub>'.length); }
            else if (text.indexOf('</sub>', text.length - '</sub>'.length) !== -1) { text = text.substring(0, text.length - '</sub>'.length); }
            else if (text.indexOf('√)', text.length - '√)'.length) !== -1) { text = text.substring(0, text.length - '√)'.length); }
            this.setText(text.substring(0, text.length - 1));
        } else {
            this.setText('');
        }
        if (linkedvarid && this.getText()) {
        	r9.setVarValue(linkedvarid, this.getText());
            r9.PageBus.publish('r9.core.event.variableEvent', null);
        }
      //  if (feedback && this.validating()) {
       //     r9.PageBus.publish('r9.core.message', { 'name': 'message', 'value': feedback });
       // }
    };
    Kinetic.STextInput.prototype.append = function (achar) {
    	 if( this.optionMode() ){
    		  if (typeof achar === "string" || achar instanceof String) {
    			  this.setText(  achar + '');  
    		  } else if( typeof achar == "object" ){
    			  this.setMath(achar);
    		  }
         	 this.confirm();
         	 return;
         } 
        var text = this.getText() ;
        if (typeof achar === "string" || achar instanceof String) {
            if (achar == '上标') {
                achar = '<sup>';
                if (text.indexOf('<sup>', text.length - '<sup>'.length) !== -1) { text = text.substring(0, text.length - '<sup>'.length); achar = ''; }
                else { var lindexstart = text.lastIndexOf('<sup>'); var lindexend = text.lastIndexOf('</sup>'); if (lindexstart < lindexend) { achar = '<sup>'; } else if (lindexstart > lindexend) { achar = '</sup>'; } }
            }
            if (achar == '下标') {
                achar = '<sub>';
                if (text.indexOf('<sub>', text.length - '<sub>'.length) !== -1) { text = text.substring(0, text.length - '<sub>'.length); achar = ''; }
                else { var lindexstart = text.lastIndexOf('<sub>'); var lindexend = text.lastIndexOf('</sub>'); if (lindexstart < lindexend) { achar = '<sub>'; } else if (lindexstart > lindexend) { achar = '</sub>'; } }
            }
            if (achar == '√(') { achar = '√'; }
            this.setText(text + achar + '');
        } else if (typeof achar == "object") { //FIXME math object only supported in option-mode
            this.setMath(achar);
        } 
    };
    Kinetic.STextInput.prototype.confirm = function ( ) {
    	  var that = this, text = that.getText(), feedback = _r9norm(that.correctStr()),
    	  fbstyle = that.correctStyle(), fbmath = that.correctMath();
          wfeedback = _r9norm(that.wrongStr()), 
          wfbstyle = that.wrongStyle(), wfbmath = that.wrongMath();
          linkedvarid = that.getLinkedvarid();
    	  if (linkedvarid && text) {
    		  r9.setVarValue(linkedvarid, text);
              r9.PageBus.publish('r9.core.event.variableEvent', null);
          }
          if (feedback ||  fbmath || wfeedback ||  wfbmath ) {
              if (that.validating()) {
                  if (feedback || fbmath ) {
                     r9.PageBus.publish('r9.core.message', { 'name': 'message', 'style': fbstyle, 'math': fbmath, 'borderType': 'Cloud',
                    	 'value': feedback, x: that.x(), y : that.y() });
                  }
              } else {
                  if (wfeedback || wfbmath ) {
                      r9.PageBus.publish('r9.core.message', { 'name': 'message', 'style': wfbstyle, 'math': wfbmath, 'borderType': 'Cloud',
                    	  'value': wfeedback, x: that.x(), y : that.y() });
                  }
              }
          }
    };

    Kinetic.Util.extend(Kinetic.STextInput, Kinetic.Shape);

    Kinetic.Factory.addGetterSetter(Kinetic.STextInput, 'cornerRadius', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.STextInput, 'placeholder', '');
    Kinetic.Factory.addGetterSetter(Kinetic.STextInput, 'answers', '');
    Kinetic.Factory.addGetterSetter(Kinetic.STextInput, 'text', '');
    Kinetic.Factory.addGetterSetter(Kinetic.STextInput, 'correctStr', '');
    Kinetic.Factory.addGetterSetter(Kinetic.STextInput, 'correctStyle', []);
    Kinetic.Factory.addGetterSetter(Kinetic.STextInput, 'correctMath', null);
    Kinetic.Factory.addGetterSetter(Kinetic.STextInput, 'wrongStr', '');
    Kinetic.Factory.addGetterSetter(Kinetic.STextInput, 'wrongStyle', []);
    Kinetic.Factory.addGetterSetter(Kinetic.STextInput, 'wrongMath', null);
 
    Kinetic.Factory.addGetterSetter(Kinetic.STextInput, 'valid', true);
    Kinetic.Factory.addGetterSetter(Kinetic.STextInput, 'fontFamily', r9_global_font);
    Kinetic.Factory.addGetterSetter(Kinetic.STextInput, 'fontSize', 18); 
    Kinetic.Factory.addGetterSetter(Kinetic.STextInput, 'fontStyle', 'normal');
    Kinetic.Factory.addGetterSetter(Kinetic.STextInput, 'fontVariant', 'normal');
    Kinetic.Factory.addGetterSetter(Kinetic.STextInput, 'padding', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.STextInput, 'align', 'left');
    Kinetic.Factory.addGetterSetter(Kinetic.STextInput, 'pack', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.STextInput, 'useUnderline', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.STextInput, 'textColor', 'rgba(0,0,0,1)');
    Kinetic.Factory.addGetterSetter(Kinetic.STextInput, 'math', null); //math object only supported in option-mode
    Kinetic.Factory.addGetterSetter(Kinetic.STextInput, 'linkedvarid', null);
    Kinetic.Factory.addGetterSetter(Kinetic.STextInput, 'optionMode', false);

    Kinetic.Collection.mapMethods(Kinetic.STextInput);
})();;

(function () {

    Kinetic.R9VScrollView = function (config) {
        var dragPointY;
        this.___init(config);
    };

    Kinetic.R9VScrollView.prototype = {
        ___init: function (config) {
            Kinetic.Shape.call(this, config);
            this.className = 'R9VScrollView';
            this.sceneFunc(this._sceneFunc);
            this.on("mousedown touchstart", function (event) { this.dragPointY = this.getStage().getPointerPosition().y; });
            this.on("mouseup touchend", function (event) { this.dragPointY = 0; });
            this.on("mousemove touchmove", function (event) { this._scrollFunc(); });

            this.hitFunc(this._hitFunc);
        },
        _hitFunc: function (context) {
            var width = this.getWidth(),
                height = this.getHeight();

            context.beginPath();
            context.rect(0, 0, width, height);
            context.closePath();
            context.fillStrokeShape(this);
        },

        _scrollFunc: function () {

            if (this.dragPointY > 0) {
                this.setDuration(-1); //stop autoscroll
                var p2 = this.getStage().getPointerPosition(), ydiff = p2.y - this.dragPointY;
                this.dragPointY = p2.y;
                var r9callback = this.getR9callback(),
                    width = this.getWidth(),
                    height = this.getHeight(),
                    r9vpheight = this.getR9vpheight(),
                    r9vpstart = this.getR9vpstart(),
                    r9vpfull = this.getR9vpfull();
                if (r9vpstart < 0 || r9vpheight <= 0 || r9vpfull < r9vpheight || r9vpfull <= height || !r9callback) { return; }

                var thumbsize = height * r9vpheight / r9vpfull;
                var trange = height - thumbsize;
                var vrange = r9vpfull - r9vpheight;

                var spos = r9vpstart * trange / vrange;
                spos += ydiff;
                if (spos < 0) { spos = 0; }
                if (spos + thumbsize > height) { spos = height - thumbsize; }

                r9vpstart = spos * vrange / trange;

                this.setR9vpstart(r9vpstart);
                if (r9callback) {
                    r9callback.setScrollViewport(r9vpstart, height);
                }

                this.getStage().draw();
            }
        },
        _sceneFunc: function (context) {
            var r9callback = this.getR9callback(),
                width = this.getWidth(),
                height = this.getHeight(),
                thumbcolor = this.getThumbcolor(),
                trackcolor = this.getTrackcolor(),
                r9vpheight = this.getR9vpheight(),
                r9vpstart = this.getR9vpstart(),
                r9vpfull = this.getR9vpfull(),
                duration = this.getDuration(),
                //progress = this.getProgress(),
                progressvalue = this.progressvalue(),
                trackwidth = 20;



            context.beginPath();
            context.moveTo(0, 0);
            context.lineTo(width, 0);
            context.lineTo(width, height);
            context.lineTo(0, height);
            context.lineTo(0, 0);
            context.closePath();
            context.strokeShape(this);


            context.beginPath();
            context.moveTo(0, 0);
            context.lineTo(width - trackwidth, 0);
            context.lineTo(width - trackwidth, height);
            context.lineTo(0, height);
            context.lineTo(0, 0);
            context.closePath();
            context.fillStrokeShape(this);

            context.setAttr('fillStyle', trackcolor);
            context.setAttr('strokeStyle', trackcolor);
            context.beginPath();

            context.moveTo(width - trackwidth, 0);
            context.lineTo(width, 0);
            context.lineTo(width, height);
            context.lineTo(width - trackwidth, height);
            context.lineTo(width - trackwidth, 0);
            context.closePath();
            context.fillShape(this);




            if (r9vpstart < 0 || r9vpheight <= 0 || r9vpfull < r9vpheight || r9vpfull <= height || !r9callback) { return; }



            var thumbsize = height * r9vpheight / r9vpfull;
            var trange = height - thumbsize;
            var vrange = r9vpfull - r9vpheight;

            var spos;

            if (duration > 0 && progressvalue >= 0) {
                spos = trange * progressvalue * 1.0;
                r9vpstart = spos * vrange / trange;
                this.setR9vpstart(r9vpstart);
                if (r9callback) {
                    r9callback.setScrollViewport(r9vpstart, height);
                }
            } else {
                spos = r9vpstart * trange / vrange;
            }


            context.setAttr('fillStyle', thumbcolor);
            context.setAttr('strokeStyle', thumbcolor);

            context.beginPath();
            context.moveTo(width - trackwidth, spos);
            context.lineTo(width, spos);
            context.lineTo(width, spos + thumbsize);
            context.lineTo(width - trackwidth, spos + thumbsize);
            context.lineTo(width - trackwidth, spos);

            context.closePath();
            context.fill(this);

            context.restore();

            if (this.checked()) {
                context.setAttr('strokeStyle', 'rgba(255,0,0,1)');
                context.beginPath();
                context.rect(0, 0, this.getWidth(), this.getHeight());
                context.closePath();
                context.stroke(this);
            }

            //for click-hit test  context.beginPath();
            // context.rect(0,0,width,height);
            // context._context.fillStyle =  'rgba(' +this.getStrokeRed()+','+this.getStrokeGreen() + ',' + this.getStrokeBlue() + ',0.001)'
            // context.fill();
            //end click-hit test

        }


    };

    Kinetic.Util.extend(Kinetic.R9VScrollView, Kinetic.Shape);

    Kinetic.Factory.addGetterSetter(Kinetic.R9VScrollView, 'r9callback', null);
    Kinetic.Factory.addGetterSetter(Kinetic.R9VScrollView, 'r9vpheight', -1);
    Kinetic.Factory.addGetterSetter(Kinetic.R9VScrollView, 'r9vpstart', -1);
    Kinetic.Factory.addGetterSetter(Kinetic.R9VScrollView, 'r9vpfull', -1);
    Kinetic.Factory.addGetterSetter(Kinetic.R9VScrollView, 'duration', -1);
    //Kinetic.Factory.addGetterSetter(Kinetic.R9VScrollView, 'progress', -1);
    Kinetic.Factory.addGetterSetter(Kinetic.R9VScrollView, 'thumbcolor', null);
    Kinetic.Factory.addGetterSetter(Kinetic.R9VScrollView, 'trackcolor', null);

    Kinetic.Collection.mapMethods(Kinetic.R9VScrollView);
})();;
 
(function () {

    Kinetic.R9Medicion = function (config) {
        this.___init(config);
    };

    Kinetic.R9Medicion.prototype = {
        ___init: function (config) { 
            Kinetic.Shape.call(this, config);
            this.className = 'R9Medicion';
            this.sceneFunc(this._sceneFunc); 
        }, 
        _getContextFont: function (fontsize, fontFamily) {
            var PX_SPACE = 'px ', SPACE = ' ';
            return this.getFontStyle() + SPACE + this.getFontVariant() + SPACE
                + (typeof fontsize == 'undefined' ? this.getFontSize() : fontsize) + PX_SPACE
                + (typeof fontFamily == 'undefined' ? this.getFontFamily() : fontFamily);
        },
        _sceneFunc: function (context) {
            var startX = this.startX(),
                startY = this.startY(),
                endX = this.endX(),
                endY = this.endY(), 
                height = this.height(),
                width = this.width(),
                arrawdash = this.arrawdash(), 
                strokeWidth = this.strokeWidth() || 1, 
                tipOffset = this.tipOffset(),
                text = this.text(),
                fontSize = this.fontSize(),
                math = this.math(),
                textColor = this.textColor();

            var start = new Point(startX, startY), end = new Point(endX, endY),
                middle =  start.interpolate(end, 0.5);
                len = start.distance(  end), angle = start.calcAngle(  end);
           
            context.beginPath(); 
                var ap1 = end.calcPoint(  angle   - 90, 10); 
                context.moveTo(ap1.x, ap1.y);
                var ap2 = end.calcPoint(  angle  + 90, 10);
                context.lineTo(ap2.x, ap2.y); 
            context.fillStrokeShape(this);   
            
            context.beginPath(); 
            var ap1 = start.calcPoint(  angle   - 90, 10); 
            context.moveTo(ap1.x, ap1.y);
            var ap2 = start.calcPoint(  angle  + 90, 10);
            context.lineTo(ap2.x, ap2.y); 
             context.fillStrokeShape(this);   
            
            var newStart = start;
            var newEnd = end;
             
            var arrowSize = strokeWidth * 3; if (arrowSize < 10) arrowSize = 10;
   
            newStart = start.calcPoint(  angle , arrowSize - 5 - tipOffset);
            newEnd = end.calcPoint(  angle + 180, arrowSize - 5 - tipOffset);
             
            var twidth;
            if (math != null) {   
            	twidth =   math.topw ; 
            } else {  
            	twidth =   context._context.measureText(text).width  ; 
            }
            var m1 = start.calcPoint(  angle, Math.max(5, (len-twidth)/2-4)) ;
            this.setDash(arrawdash == 1 ? [5, 5] : [0, 0]);
            context.beginPath();
            context.moveTo(newStart.x, newStart.y);
            context.lineTo(m1.x, m1.y);
            context.fillStrokeShape(this);
          
            m1 = end.calcPoint(  angle + 180 , Math.max(5, (len-twidth)/2-4)) ;
            context.beginPath();
            context.moveTo(m1.x, m1.y);
            context.lineTo(end.x, end.y);
            context.fillStrokeShape(this);
            
            var sw = strokeWidth;
            this.setDash([0, 0]);
            var aheadsize = sw * 3; if (sw < 10) sw = 10; 
            context.beginPath();  
                    var newEnd = end;
                    var ap1 = newEnd.calcPoint(  angle - 45 - 90, aheadsize);
                    context.moveTo(newEnd.x, newEnd.y);
                    context.lineTo(ap1.x, ap1.y);
                    var ap2 = newEnd.calcPoint(  angle + 45 + 90, aheadsize);
                    context.lineTo(ap2.x, ap2.y);
                    context.lineTo(newEnd.x, newEnd.y); 
            context.fillStrokeShape(this);
            
            context.beginPath();  
                var newStart = start;
                var ap1 = newStart.calcPoint(  angle - 45 , aheadsize);
                context.moveTo(newStart.x, newStart.y);
                context.lineTo(ap1.x, ap1.y);
                var ap2 = newStart.calcPoint(  angle + 45  , aheadsize);
                context.lineTo(ap2.x, ap2.y);
                context.lineTo(newStart.x, newStart.y); 
            context.fillStrokeShape(this);
            
            
             context.setAttr('textBaseline', 'middle'); 
        //   context.setAttr('textAlign', 'center'); 
            context.setAttr('font',   this._getContextFont());
            context.translate( middle.x, middle.y );
             context.rotate(angle*Math.PI/180);
            if (textColor) {
                 context.setAttr('fillStyle', textColor);
                context.setAttr('strokeStyle', textColor);
            }
            
            var  tXoff = - twidth/2, tYoff = 0;
            if (math != null) {    
                r9_drawMathForm.call(this, this,
                    math, context, textColor, { top: 0, left: 0, right: 0, bottom: 0 },
                    tXoff, tYoff,// + Math.max(0, (height - math.toph) / 2) + fontSize,
                    fontSize);
                
            } else {   
              //  var lineHeight = getFontHeight(null, this.getFontStyle(), this.getFontSize(), this.getFontFamily()); 
                 context.fillText(text, tXoff, tYoff);   
            }

        },
        getDataPointAt: function (pos) {
            if (pos == 0) {
                var x = this.startX(), y = this.startY();
                return new Point(x, y);
            }
            var x = this.endX(), y = this.endY();
            return new Point(x, y);
        },
        setDataPointAt: function (pos, point) {
            if (pos == 0) {
                this.setStartX(point.x);
                this.setStartY(point.y);
            } else {
                this.setEndX(point.x);
                this.setEndY(point.y);
            }
        },
        changeDataPointAt: function (pos, shift) {
            if (pos == 0) {
                this.setStartX(this.getStartX() + shift.x);
                this.setStartY(this.getStartY() + shift.y);
            } else {
                this.setEndX(this.getEndX() + shift.x);
                this.setEndY(this.getEndY() + shift.y);
            }
        },
        toPathString: function () {
            var startX = this.startX(),
                startY = this.startY(),
                endX = this.endX(),
                endY = this.endY();
            return "M " + startX + " " + startY +
                " L " + endX + " " + endY + " ";
        }
    };
    Kinetic.Util.extend(Kinetic.R9Medicion, Kinetic.Shape);

    Kinetic.Factory.addGetterSetter(Kinetic.R9Medicion, 'startX', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Medicion, 'startY', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Medicion, 'endX', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Medicion, 'endY', 0); 
    Kinetic.Factory.addGetterSetter(Kinetic.R9Medicion, 'arrawdash', 0); 
    
    Kinetic.Factory.addGetterSetter(Kinetic.R9Medicion, 'tipOffset', 0);  
    Kinetic.Factory.addGetterSetter(Kinetic.R9Medicion, 'strokeWidth', 2);   
    Kinetic.Factory.addGetterSetter(Kinetic.R9Medicion, 'fontFamily', r9_global_font);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Medicion, 'fontSize', 18);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Medicion, 'lineHeight', 1);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Medicion, 'fontStyle', 'normal');
    Kinetic.Factory.addGetterSetter(Kinetic.R9Medicion, 'fontVariant', 'normal');  
    Kinetic.Factory.addGetterSetter(Kinetic.R9Medicion, 'textColor', 'rgba(0,0,0,1)');
    Kinetic.Factory.addGetterSetter(Kinetic.R9Medicion, 'math', null); //math object only supported in option-mode
    Kinetic.Factory.addGetterSetter(Kinetic.R9Medicion, 'text', null);  
    
    
    Kinetic.Collection.mapMethods(Kinetic.R9Medicion);
})();
;

(function () {

    Kinetic.R9Speedometer = function (config) {
        this.___init(config);
    };

    Kinetic.R9Speedometer.prototype = {
        ___init: function (config) {
            Kinetic.Shape.call(this, config);
            this.className = 'R9Speedometer'; 
            this.sceneFunc(this._sceneFunc);
            this.hitFunc(this._hitFunc);
        },
        _hitFunc: function (context) {
            var width = this.getWidth(), height = this.getHeight();
            context.beginPath();
            context.rect(0, 0, width, height);
            context.closePath();
            context.fillStrokeShape(this);
        },
 
        _sceneFunc: function (ctx) {
            var  w = this.getWidth(), 
                arcAngle = this.arcAngle(),
                numTicks = this.numTicks(),
                tickLength = this.tickLength(),
                velocity = this.velocity(),
                startAngle = this.startAngle(),
                needleHeight = this.needleHeight(),
                needleWidth = this.needleWidth();
             
    		var cx =  w/2, cy =   w/2;
			var center = new Point(cx,  cy);
			var margin = 10,  radius = w/2 - margin ;
	        ctx.setAttr("lineWidth", 2);
	      //  g.setPaint(this.getStrokePaint());
	      //  g.setStrokeWidth(this.getStrokeWidth());
	      //  g.setOpacity(this.getStrokeOpacity()* this.getOpacity());
			ctx.beginPath();
			ctx.arc(cx, cy, radius,  ( 360-startAngle )* Math.PI/180,   (startAngle -180) * Math.PI/180);	
			ctx.strokeShape(this);
	        //draw ticker
	       
			ctx.beginPath();
	        var p = center.calcPoint( -startAngle, radius), p2;
	        ctx.moveTo(cx, cy ); ctx.lineTo( p.x, p.y );
	        p = center.calcPoint( -startAngle + arcAngle, radius);
	        ctx.moveTo(cx, cy ); ctx.lineTo( p.x, p.y );
	        ctx.strokeShape( this );
	        var arc_unit = arcAngle  / (numTicks-1);
	        for(var i = 0; i < numTicks; i++) {
	        	 ctx.beginPath();
	        	 p = center.calcPoint(  -startAngle + arc_unit*i, radius);
	        	 p2  = center.calcPoint(  -startAngle + arc_unit*i, radius-tickLength);
	        	 ctx.moveTo(p2.x, p2.y);  ctx.lineTo(p.x, p.y);
	        	 p = center.calcPoint( -startAngle + arc_unit*i, radius+ tickLength );
	        	 ctx.strokeShape( this );
	             ctx.setAttr('fillStyle', this.handColorStr() );
	             ctx.setAttr('font',   parseInt(Math.ceil(radius/4)) + 'px Georgia' );
	        	 ctx.fillText((i*10) ,   p.x-5, p.y);
	        }
	        
	        //draw hand
	        //ctx.setAttr("lineWidth", 6);
	        ctx.setAttr('strokeStyle', this.handColorStr() );
	        ctx.beginPath();
	        var ag = -startAngle + arcAngle * velocity /100, len = radius -tickLength*2, p3;
	        p = center.calcPoint (  ag , len ); 
	        p2 = center.calcPoint (  ag-2, len -5); 
		    p3 = center.calcPoint (  ag+2, len -5);     
	        ctx.moveTo(cx, cy);  ctx.lineTo( p2.x, p2.y ); ctx.lineTo( p.x, p.y ); ctx.lineTo( p3.x, p3.y ); ctx.lineTo( cx, cy ); 
	        ctx.closePath();
	        ctx.fillStrokeShape( this );
        }
    };

    Kinetic.Util.extend(Kinetic.R9Speedometer, Kinetic.Shape); 
    Kinetic.Factory.addGetterSetter(Kinetic.R9Speedometer, 'arcAngle', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Speedometer, 'numTicks', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Speedometer, 'tickLength', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Speedometer, 'needleWidth', 0);
    Kinetic.Factory.addGetterSetter(Kinetic.R9Speedometer, 'needleHeight', 0); 
    Kinetic.Factory.addGetterSetter(Kinetic.R9Speedometer, 'startAngle', 0); 
    Kinetic.Factory.addGetterSetter(Kinetic.R9Speedometer, 'velocity', 0); 
    Kinetic.Factory.addGetterSetter(Kinetic.R9Speedometer, 'handColorStr', ''); 
    

    Kinetic.Collection.mapMethods(Kinetic.R9Speedometer);
})();;//var r9_global_font = "'黑体','Courier New',Microsoft YaHei','STSong',''宋体',sans-serif";

//(function(window){
var    r9_global_font = "FangSong";// "Arial";//"黑体";
var    _fs2height = {};
var    r9_cloud = "m194.59129,18.32957c2.6611,-0.41561 5.67701,-0.78966 8.60423,-0.78966c14.90216,0 26.96582,5.65233 26.96582,12.63463c0,0.78966 -0.17741,1.53777 -0.44352,2.28587l0,0c9.57996,1.87026 18.6277,6.73293 18.18419,11.88652c-0.35481,3.78208 -1.06444,7.81352 -10.02348,11.51247l0,0c7.53979,2.82617 7.71719,12.30214 4.16906,16.2089c-3.63684,4.03144 -10.467,8.14601 -29.62692,11.30467c-7.27368,8.06289 -26.69971,14.83738 -46.48056,14.83738c-8.51552,0 -16.76493,-1.03903 -23.6838,-2.86773l0,0c-7.18497,2.32743 -15.70049,3.65739 -25.10305,3.65739c-16.76493,0 -31.7558,-4.4055 -39.38429,-10.80593l0,0c-19.95825,0 -40.18262,-6.35888 -43.90816,-15.21143l0,0c-17.03104,-2.36899 -29.36081,-9.72534 -29.36081,-18.49477c0,-4.03144 2.5724,-7.77196 7.09627,-10.88905l0,0c-2.39499,-2.28587 -3.72554,-4.90423 -3.72554,-7.60571c0,-9.10192 15.34568,-16.62451 34.4169,-17.28949l0,0c6.47534,-6.06795 19.86955,-10.26563 35.39264,-10.26563c4.25776,0 8.24941,0.29093 12.06366,0.87279l0,0c6.74145,-3.44959 16.58753,-5.61077 27.40934,-5.61077c11.35403,0 21.46621,2.36899 28.29637,6.15107l0,0c5.3222,-1.95338 12.06366,-3.15866 19.24863,-3.15866c14.99087,0.08312 26.96582,4.98735 29.89303,11.63716l0,0z";

//})(window);
r9_log_console = function (e) {
    if (window.console) {
        console.error("Error:" + e);
        console.log(e.stack);
    }
};
function calFontHeight(fontStyle) {
    try {
        var body = document.body;//.getElementsByTagName["body"][0];
        var dv = document.createElement("div");
        var dtxt = document.createTextNode("M");
        dv.appendChild(dtxt);
        dv.setAttribute("style", fontStyle);
        body.appendChild(dv);
        var r = dv.offsetHeight;
        body.removeChild(dv);
        return r;
    } catch (e) {
        return 0;
    }
};
 
function getFontHeight(ctx, weight, fsize, fname) {
    weight = weight || "normal";
    fname = fname || r9_global_font;
    var fs = weight + " " + fsize + " " + fname;
    var h = _fs2height[fs];
    if (!h) {
        if (ctx) {
            var ofont = ctx.font;
            ctx.font = fs;
            h = ctx.measureText('M').width;
            _fs2height[fs] = h;
            ctx.font = ofont;
        } else {
            h = calFontHeight(fs);
            if (h) {
                _fs2height[fs] = h;
            } else {
                return fsize;
            }
        }
    }
    return h;
}

 
r9_formatTicker = function (amount) {
    var i = parseFloat(amount);
    if (isNaN(i)) { i = 0; }
    var minus = '';
    if (i < 0) { minus = '-'; }
    i = Math.abs(i);
    i = parseInt((i + .005) * 100);
    i = i / 100;
    s = new String(i);
    if (s.indexOf('.') < 0) { }
    else if (s.indexOf('.') == (s.length - 2)) { s += '0'; }
    s = minus + s;
    return s;
};

r9_drawLineBorder = function(ctx,  lineType,   width,   height,   corner,   borderWidth) {
	
	if (corner > 0) {
		r9_drawRounded(ctx, 0, 0, width, height, corner, corner);
	} else { 
		
	    var c = ctx /*.getCanvas()._canvas.getContext('2d')*/, t = lineType, sw = borderWidth ;
		if( t == 'Single'){ 
			c.beginPath();
			c.rect(0, 0, width, height);
			c.closePath();
		}  if ( t =='Double' ) {
			c.beginPath();
			c.rect(0, 0, width, height);
		 	c.closePath();
	        c.stroke( ); 
		 	c.beginPath();
			c.rect(sw +3, sw +3 , width - (sw+3)*2, height - (sw+3)*2);
			c.closePath(); 
		} else if ( t == 'SingleDeco' ) {  
			ctx.save();
			 c.setAttr('lineWidth',  sw<3? sw*3 : sw*2);
		     var dw  = Math.min(width, height)/10;
		     dw = Math.min(50, Math.max(10, dw)); 
		     c.beginPath();
			 c.moveTo(0, 0) ; c.lineTo(dw, 0); c.moveTo(width-dw, 0) ; c.lineTo( width, 0);
			 c.moveTo(width, 0) ; c.lineTo( width, dw); c.moveTo(width, height-dw) ; c.lineTo( width, height);
			 c.moveTo(width, height) ; c.lineTo( width-dw, height); c.moveTo(dw, height) ; c.lineTo( 0, height);
			 c.moveTo(0, height) ; c.lineTo( 0, height-dw);  c.moveTo(0, dw) ; c.lineTo( 0, 0);
			 c.closePath();
			 c.stroke();
			 ctx.restore(); 
			c.beginPath();
			c.rect(0, 0, width, height);
		 	c.closePath();     
		} else if ( t == 'SingleSqu' ){
			 var dw  = Math.min(width, height)/10;
		     dw = Math.min(5, Math.max(2, dw));  
		     c.beginPath(); c.rect(dw, dw, width-dw*2, height-dw*2); c.closePath();   c.stroke();  
		     c.beginPath(); c.rect(0, 0, dw*2, dw*2); c.closePath();   c.stroke();  
		     c.beginPath(); c.rect(width-dw*2, 0, dw*2, dw*2); c.closePath();   c.stroke();  
		     c.beginPath(); c.rect(width-dw*2, height-dw*2, dw*2, dw*2); c.closePath();   c.stroke();  
		     c.beginPath(); c.rect(0, height- dw*2, dw*2, dw*2); c.closePath();   
		} else if ( t == 'DoubleSqu' ){
			 var margin  = Math.min(width, height)/10;
			 margin = Math.min(10, Math.max(4, margin)); 
			 var m  = margin/2, w = width - margin*2, h = height - margin*2; 
			  c.beginPath();    
			 c.moveTo(margin + m, m)
			  c.lineTo(margin+m, margin+m)
			  c.lineTo(m, margin+m)
			  c.lineTo(m, height - margin-m)
			  c.lineTo(m + margin, height - margin - m)
			  c.lineTo(m + margin, height   - m)
			  c.lineTo(width -margin -m, height -m)
			  c.lineTo(width -margin -m, height -m -margin)
			  c.lineTo(width - m, height - m - margin)
			  c.lineTo(width - m, margin+m)
			  c.lineTo(width - m - margin, margin + m)
			  c.lineTo(width - m - margin,   m)
			  c.lineTo(m + margin,  m)
			  c.stroke()
			  c.moveTo( m, m)
			  c.lineTo(m +m, m)
			  c.lineTo(m+m, height -m)
			  c.lineTo(m  , height - m)
			  c.lineTo(m, height - margin)
			  c.lineTo(width-m, height - margin)
			  c.lineTo(width - m, height - m)
			  c.lineTo(width - margin, height - m)
			  c.lineTo(width - margin,  m)
			  c.lineTo(width - m, m)
			  c.lineTo(width - m, margin )
			  c.lineTo( m, margin)
			  c.lineTo(m, m)  
			  c.closePath()
			  c.stroke()  
		}
		
	}
	
};
r9_drawRounded = function (ctx, x, y, w, h, r) {
    var rawctx = ctx.getCanvas()._canvas.getContext('2d');
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    rawctx.beginPath();
    rawctx.moveTo(x + r, y);
    rawctx.arcTo(x + w, y, x + w, y + h, r);
    rawctx.arcTo(x + w,
        y + h, x, y + h, r);
    rawctx.arcTo(x, y + h, x, y, r);
    rawctx.arcTo(x, y, x + w, y, r);
    rawctx.closePath();
};
r9_drawLinePath = function (points, length, progress, duration, lastPoint) {
    var tp, len, n, endX = -1, endY = -1, curdata = [];

    var totallen = 0, px = points[0], py = points[1], acclen = [];
    for (n = 0; n < length; n += 2) {
        totallen += Math.sqrt((px - points[n]) * (px - points[n]) + (py - points[n + 1]) * (py - points[n + 1]));
        acclen.push(totallen);
    }
    var proglen = totallen * progress;
    curdata.push(points[0]);
    curdata.push(points[1]);
    for (var n = 0; n < acclen.length; n++) {

        if (acclen[n] <= proglen) {
            curdata.push(points[2 * n + 2]);
            curdata.push(points[2 * n + 3]);
            if (n + 1 > lastPoint) {
                lastPoint = (n + 1);
                endX = points[2 * n + 2]
                endY = points[2 * n + 3]
                break;
            }
        } else {
            var flen = acclen[n] - acclen[n - 1];
            var plen = proglen - acclen[n - 1];
            endX = points[2 * n] + (points[2 * n + 2] - points[2 * n]) * plen / flen;
            endY = points[2 * n + 1] + (points[2 * n + 3] - points[2 * n + 1]) * plen / flen;
            curdata.push(endX);
            curdata.push(endY);

            break;
        }
    }
    if (curdata.length == 2)
        return { lastPoint: lastPoint };

    if (endX < 0 && endY < 0) {
        endX = points[points.length - 2];
        endY = points[points.length - 1];

    }
    return { tp: tp, len: len, n: n, endX: endX, endY: endY, curdata: curdata, lastPoint: lastPoint };
}


    ; (function () {
        var r9RAFtime = 0;
        var r9RAFPx = 'webkit moz ms o'.split(' '); //各浏览器前缀

        var raf = window.requestAnimationFrame;
        var caf = window.cancelAnimationFrame;

        //通过遍历各浏览器前缀，来得到requestAnimationFrame和cancelAnimationFrame在当前浏览器的实现形式
        for (var i = 0; i < r9RAFPx.length; i++) {
            if (raf && caf) {
                break;
            }
            var prefix = r9RAFPx[i];
            raf = raf || window[prefix + 'RequestAnimationFrame'];
            caf = caf || window[prefix + 'CancelAnimationFrame'] || window[prefix + 'CancelRequestAnimationFrame'];
        }

        //如果当前浏览器不支持requestAnimationFrame和cancelAnimationFrame，则会退到setTimeout
        if (!raf || !caf) {
            raf = function (callback, element) {
                var currTime = new Date().getTime();
                //为了使setTimteout的尽可能的接近每秒60帧的效果
                var timeToCall = Math.max(0, 16 - (currTime - r9RAFtime));
                var id = window.setTimeout(function () {
                    callback(currTime + timeToCall);
                }, timeToCall);
                r9RAFtime = currTime + timeToCall;
                return id;
            };

            caf = function (id) {
                window.clearTimeout(id);
            };
        }
        //得到兼容各浏览器的API
        window.requestAnimationFrame = raf;
        window.cancelAnimationFrame = caf;

    })();

var r9divmove = function (div, nx, ny, nw, nh, dur, callback) {
    var x = parseInt(div.style.left), y = parseInt(div.style.top),
        w = parseInt(div.style.width), h = parseInt(div.style.height),
        t = 60.0 * dur / 1000, duration = dur;
    var dx = typeof nx === 'number' ? (parseInt(nx) - x) / t : 0;
    var dy = typeof ny === 'number' ? (parseInt(ny) - y) / t : 0;
    var dw = typeof nw === 'number' ? (parseInt(nw) - w) / t : 0;
    var dh = typeof nh === 'number' ? (parseInt(nh) - h) / t : 0;

    function r() {
        if (typeof dx === 'number' && dx != 0) div.style.left = parseInt(div.style.left) + dx + 'px';
        if (typeof dy === 'number' && dy != 0) div.style.top = parseInt(div.style.top) + dy + 'px';
        if (typeof dh === 'number' && dh != 0) div.style.width = parseInt(div.style.width) + dw + 'px';
        if (typeof dw === 'number' && dw != 0) div.style.height = parseInt(div.style.height) + dh + 'px';
    };
    requestAnimationFrame(function () {
        r();
        duration -= 1000 / 60;
        if (duration > 0) requestAnimationFrame(arguments.callee);
        else if (callback) callback();
    });
};


if (!String.prototype.startsWith) {
    (function () {
        'use strict'; // needed to support `apply`/`call` with `undefined`/`null`
        var defineProperty = (function () {
            // IE 8 only supports `Object.defineProperty` on DOM elements
            try {
                var object = {};
                var $defineProperty = Object.defineProperty;
                var result = $defineProperty(object, object, object) && $defineProperty;
            } catch (error) { }
            return result;
        }());
        var toString = {}.toString;
        var startsWith = function (search) {
            if (this == null) {
                throw TypeError();
            }
            var string = String(this);
            if (search && toString.call(search) == '[object RegExp]') {
                throw TypeError();
            }
            var stringLength = string.length;
            var searchString = String(search);
            var searchLength = searchString.length;
            var position = arguments.length > 1 ? arguments[1] : undefined;
            // `ToInteger`
            var pos = position ? Number(position) : 0;
            if (pos != pos) { // better `isNaN`
                pos = 0;
            }
            var start = Math.min(Math.max(pos, 0), stringLength);
            // Avoid the `indexOf` call if no match is possible
            if (searchLength + start > stringLength) {
                return false;
            }
            var index = -1;
            while (++index < searchLength) {
                if (string.charCodeAt(start + index) != searchString.charCodeAt(index)) {
                    return false;
                }
            }
            return true;
        };
        if (defineProperty) {
            defineProperty(String.prototype, 'startsWith', {
                'value': startsWith,
                'configurable': true,
                'writable': true
            });
        } else {
            String.prototype.startsWith = startsWith;
        }
    }());
}

function r9getURLPara(name) {
    var v = r9getURLPara2(name);
    return v == null ? "" : v;
}
function r9getURLPara2(name) {
    return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(location.search) || [null, ''])[1].replace(/\+/g, '%20')) || null;
};/**
 * use to render latax data generated from JLataxMath java project.
 * precondition: custom font is already loaded!!!!
 *  this version use kinetics drawing, small changes needed for other framework
 */

(function (window) {


    var gray = "rgb(102, 102, 102)";
    var blue = "rgb(153, 153, 255)";
    var SERIF = 0;
    var SANSSERIF = 1;
    var BOLD = 2;
    var ITALIC = 4;
    var ROMAN = 8;
    var TYPEWRITER = 16;

    // point-to-pixel conversion
    var PIXELS_PER_POINT = 1;

    // font scale for deriving
    var FONT_SCALE_FACTOR = 100;

    // for comparing floats with 0
    var PREC = 0.0000001;


    var drawCircle = function (ctx, x, y) {
        ctx.strokeStyle = blue;
        ctx.moveTo(x, y);
        ctx.arc(0, 0, 8, 8, 0, 360);
        ctx.strokeStyle = 'black';
        ctx.arc(0, 0, 8, 8, 0, 360);
        ctx.moveTo(-x, -y);
    };

    var roundRect = function (ctx, x, y, width, height, radius, fill, stroke) {
        if (typeof stroke === 'undefined') {
            stroke = true;
        }
        if (typeof radius === 'undefined') {
            radius = 5;
        }
        if (typeof radius === 'number') {
            radius = { tl: radius, tr: radius, br: radius, bl: radius };
        } else {
            var defaultRadius = { tl: 0, tr: 0, br: 0, bl: 0 };
            for (var side in defaultRadius) {
                radius[side] = radius[side] || defaultRadius[side];
            }
        }
        ctx.beginPath();
        ctx.moveTo(x + radius.tl, y);
        ctx.lineTo(x + width - radius.tr, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
        ctx.lineTo(x + width, y + height - radius.br);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
        ctx.lineTo(x + radius.bl, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
        ctx.lineTo(x, y + radius.tl);
        ctx.quadraticCurveTo(x, y, x + radius.tl, y);
        ctx.closePath();
        if (fill) {
            ctx.fill();
        }
        if (stroke) {
            ctx.stroke();
        }

    };


    /**
     * use ugly if-else...to direct map code to javascript for next step.
     * 
     * @param g
     * @param box
     */
    var draw = function (fig, box, ctx, x, y, csx, csy) {
        var boxType = box.bt;

        if ("CB" == boxType) {
            ctx.save();
            ctx.translate(x, y);
            var fstyle = box.fst == 0 ? 'normal' : (box.fst == 1 ? 'bold' : 'italic');
            var font = fstyle + ' ' + box.fsz + 'px ' + box.fname;
            var scale = 1;
            if (Math.abs(box.sz - FONT_SCALE_FACTOR) > PREC) {
                ctx.scale(box.sz / FONT_SCALE_FACTOR,
                    box.sz / FONT_SCALE_FACTOR);

                scale = box.sz / FONT_SCALE_FACTOR;
            }

            if (ctx.font != font) {
                ctx._context.font = font;
                ctx.setAttr('font', font);
            }
            ctx.fillText(box.c, 0, 0);
            ctx.restore();
        }

        if ("FcB" == boxType) {
            ctx.save();

            var s = 1;
            if (csx == csy) {
                s = csx;
                ctx.scale(1 / sx, 1 / sy);
            }

            //ctx.lineWidth = box.th;
            ctx.setAttr('lineWidth', box.th);

            var th = box.th / 2.0;
            // final Line2D.Float line = new Line2D.Float();
            var xx = x + box.spc;
            xx = (xx * s + (box.spc / 2.0) * s);
            var inc = Math.round((box.spc + box.th) * s);
            ctx.beginPath();
            for (var i = 0; i < box.N; i++) {
                ctx.moveTo(xx + th * s, (y - box.h) * s);
                ctx.lineTo(xx + th * s, y * s);
                xx += inc;
            }

            if (box.s) {
                ctx.moveTo((x + box.spc) * s, (y - box.h / 2.0) * s);
                ctx.lineTo(xx - s * box.spc / 2, (y - box.h / 2.0) * s);
            }

            ctx.stroke();
            ctx.restore();
        }


        if ("FmB" == boxType) {
            ctx.save();
            //ctx.lineWidth = box.th;
            ctx.setAttr('lineWidth', box.th);
            var th = box.th / 2;
            ctx.rect(x + th, y - box.h + th, box.w - box.th, box.h + box.dp - box.th);
            ctx.stroke(fig);

            // drawDebug(g2, x, y);
            ctx.restore();
            draw(fig, box.b1, ctx, x + box.spc + box.th, y, csx, csy);
        }


        if ("OvB" == boxType) {
            draw(fig, box.b1, ctx, x + box.spc + box.th, y, csx, csy);
            ctx.save();
            //ctx.lineWidth = box.th;
            ctx.setAttr('lineWidth', box.th);
            var th = box.th / 2;
            var r = 0.5 * Math.min(box.w - box.th, box.h + box.dp - box.th);

            roundRect(ctx, x + th, y - box.h + th, box.w - box.th, box.h + box.dp - box.th, r, false, true);
            ctx.restore();
        }

        if ("SdB" == boxType) {
            var th = box.th / 2;
            draw(fig, box.b1, ctx, x + box.spc + box.th, y, csx, csy);
            ctx.save();
            //ctx.lineWidth = box.th;
            ctx.setAttr('lineWidth', box.th);

            ctx.rect(x + th, y - box.h + th, box.w - box.sdr - box.th, box.h + box.dp - box.sdr - box.th);
            ctx.stroke(fig);
            var penth = Math.abs(1 / csx);
            //  ctx.lineWidth =penth ;
            ctx.setAttr('lineWidth', penth);
            ctx.rect(x + box.sdr - penth, y + box.dp - box.sdr - penth, box.w - box.sdr, box.sdr);
            ctx.fill(fig);
            ctx.rect(x + box.w - box.sdr - penth, y - box.h + th + box.sdr, box.sdr, box.dp + box.h - 2 * box.sdr - th);
            ctx.fill(fig);
            ctx.restore();
        }

        if ("GgB" == boxType) {
            // BasicStroke st = new BasicStroke(3.79999995f,
            // BasicStroke.CAP_BUTT, BasicStroke.JOIN_MITER, 4f);
            ctx.save();
            var oldS = ctx.lineWidth;
            ctx.translate(x + 0.25 * box.h / 2.15, y - 1.75 / 2.15 * box.h);
            g2.setColor(gray);
            //  ctx.lineWidth = 3.79999995;
            ctx.setAttr('lineWidth', 3.79999995);
            ctx.scale(0.05 * box.h / 2.15, 0.05 * box.h / 2.15);
            ctx.rotate(-26 * Math.PI / 180, 20.5, 17.5);
            ctx.arc(0, 0, 43, 32, 0, 360);
            ctx.rotate(26 * Math.PI / 180, 20.5, 17.5);
            ctx.lineWidth = (oldS);
            ctx.setAttr('lineWidth', oldS);
            drawCircle(g2, 16, -5);
            drawCircle(g2, -1, 7);
            drawCircle(g2, 5, 28);
            drawCircle(g2, 27, 24);
            drawCircle(g2, 36, 3);

            ctx.restore();
        }


        if ("HB" == boxType) {
            var xPos = x;
            for (var ii = 0; ii < box.cdr.length; ii++) {
                draw(fig, box.cdr[ii], ctx, xPos, y + box.cdr[ii].sft, csx, csy);
                xPos += box.cdr[ii].w;
            }
        }

        if ("HR" == boxType) {
            if (box.sft == 0) {
                ctx.beginPath();
                ctx.rect(x, y - box.h, box.w, box.h);
                ctx.closePath();
                ctx.fill(fig);
            } else {
                ctx.beginPath();
                ctx.rect(x, y - box.h + box.sft, box.w, box.h);
                ctx.closePath();
                ctx.fill(fig);
            }
        }
        if ("JrB" == boxType) {
            var oldf = ctx.font;
            var fstyle = box.fst == 0 ? 'normal' : (box.fst == 1 ? 'bold' : 'italic');
            ctx.font = fstyle + ' ' + box.fsz + 'px ' + box.fname;
            // ctx._context.font = ctx.font; 
            // ctx.setAttr('font', font); 

            ctx.translate(x, y);
            ctx.scale(0.1 * box.sz, 0.1 * box.sz);
            ctx.fillText(box.c, 0, 0);  // FIXME

            ctx.scale(10 / box.sz, 10 / box.sz);
            ctx.translate(-x, -y);
            // ctx.font = oldf;
            ctx.setAttr('font', oldf);
            // ctx._context.font = ctx.font; 
        }


        if ("OB" == boxType) {
            draw(fig, box.b1, ctx, x, y, csx, csy);
            var yVar = y - box.b1.h - box.b2.w;
            box.b2.dp = (box.b2.h + box.b2.dp);
            box.b2.h = (0);
            if (box.o) { // draw delimiter and box.b3 above box.b1 box
                ctx.save();
                var transX = x + (box.b2.h + box.b2.dp) * 0.75, transY = yVar;

                g2.translate(transX, transY);
                g2.rotate(Math.PI / 2);
                box.b2.draw(fig, box.b2, ctx, 0, 0, csx, csy);
                stx.restore();

                // draw superscript
                if (box.b3 != null) {
                    draw(fig, box.b3, ctx, x, yVar - box.k - box.b3.dp, csx, csy);
                }
            }
            yVar = y + box.b1.dp;
            if (!box.o) { // draw delimiter and box.b3 under box.b1 box
                ctx.save();

                var transX = x + (box.b2.h + box.b2.dp) * 0.75, transY = yVar;
                g2.translate(transX, transY);
                g2.rotate(Math.PI / 2);
                box.b2.draw(fig, g2, 0, 0);

                ctx.restore();;
                yVar += box.b2.w;

                // draw subscript
                if (box.b3 != null) {
                    draw(fig, box.b3, ctx, x, yVar + box.k + box.b3.h, csx, csy);
                }
            }
        }

        if ("RB" == boxType) {
            ctx.translate(x, y);
            ctx.scale(-1, 1);
            draw(fig, box.b1, ctx, -w, 0, csx, csy);
            ctx.scale(-1, 1);
            ctx.translate(-x, -y);
        }
        if ("RtB" == boxType) {
            y -= box.sY;
            x += box.sX - xmin;
            ctx.rotate(- box.a, x, y);
            draw(fig, box.b1, ctx, x, y, csx, csy);
            ctx.rotate(box.a, x, y);
        }

        if ("ScB" == boxType) {
            if (xscl != 0 && yscl != 0) {
                var dec = xscl < 0 ? box.w : 0;
                ctx.translate(x + dec, y);
                ctx.scale(xscl, yscl);
                draw(fig, box.b1, ctx, 0, 0, csx, csy);
                ctx.scale(1 / xscl, 1 / yscl);
                ctx.translate(-x - dec, -y);
            }
        }
        if ("StB" == (boxType)) {
        }
        if ("VB" == (boxType)) {
            var yPos = y - box.h;
            for (var ii = 0; ii < box.cdr.length; ii++) {
                var b = box.cdr[ii];
                yPos += b.h;
                draw(fig, b, ctx, x + b.sft - box.lmp, yPos, csx, csy);
                yPos += b.dp;
            }
        }
        if ("OBr" == (boxType)) {
            var yPos = y - box.h;
            for (var ii = 0; ii < box.cdr.length; ii++) {
                var b = box.cdr[ii];
                yPos += b.h;
                draw(fig, b, ctx, x + b.sft - box.lmp, yPos, csx, csy);
                yPos += b.dp;
            }
        }
    };
    /**
     * R9RenderBox box, context ctx, Color color, Insets insets, int x, int y ,
     * float size //font size
     */
    var paintIcon = function (fig, box, ctx, color, insets, x, y, size) {
        //if( typeof ctx._context != 'undefined')
        //    ctx = ctx._context;
        // copy graphics settings
        ctx.save();
        ctx.setAttr('textBaseline', 'alphabetic');

        ctx.translate(x, y);
        // new settings
        ctx.scale(size, size); // the point size
        if (color != null) {
            //ctx.fillStyle  =  color ;  
            ctx.setAttr('fillStyle', color);
            ctx.setAttr('strokeStyle', color);
        } else {
            // ctx.fillStyle  = 'black';
            ctx.setAttr('fillStyle', color);
            ctx.setAttr('strokeStyle', color);
        }
        // draw formula box
        if (insets == null)
            draw(fig, box, ctx, 0, box.h, size, size);
        else
            draw(fig, box, ctx, insets.left / size, insets.top / size, size, size);
        // if( insets == null)
        //    draw(fig, box, ctx,  x/size,  y/size + box.h,  size, size);
        //else
        //    draw(fig, box, ctx,  (x + insets.left)/ size, (y+insets.top)/ size+box.h, size, size );

        ctx.translate(-x, -y);
        // restore graphics settings 
        ctx.restore();
    };



    window.r9_drawMathForm = paintIcon;
})(window);

;
var normalizeString = function (content) {
    if (content)
        return content.replace(/r9newline/g, '\n').replace(/r9apostrophe/g, "'").replace(/r9backslash/g, "\\").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    else
        return content;
}
var _r9norm = function (content) {
    return normalizeString(content);
}


var r9figure = function (properties) {
    var newpropertis = {};
    for (var key in properties) {
        newpropertis[fromShortTag(key)] = properties[key];
    }
    return newpropertis;
}


var fromShortTag = function (tag) {
    if ("sw" == tag)
        return "strokeWidth";
    if ("sr" == tag)
        return "strokeRed";
    if ("sb" == tag)
        return "strokeBlue";
    if ("sg" == tag)
        return "strokeGreen";
    if ("sa" == tag)
        return "strokeAlpha";
    if ("fpi" == tag)
        return "fillPatternImage";
    if ("fr" == tag)
        return "fillRed";
    if ("fg" == tag)
        return "fillGreen";
    if ("fb" == tag)
        return "fillBlue";
    if ("fal" == tag)
        return "fillAlpha";

    if ("ra" == tag)
        return "radius";
    if ("dr" == tag)
        return "draggable";
    if ( "vdr" == tag )
		return "vertexDraggable";
    if ( "loss" == tag )
		return "lineOffsetStart";
    if ( "lose" == tag )
		return "lineOffsetEnd"; 
    
    
    if ("sed" == tag)
        return "shadowEnabled";
    if ("fs" == tag)
        return "fontStyle";
    if ("aln" == tag)
        return "align";
    if ("ran" == tag)
        return "resumeAnimation";

    if ("dur" == tag)
        return "duration";
    if ("ff" == tag)
        return "fontFamily";
    if ("fsz" == tag)
        return "fontSize";
    if ("opa" == tag)
        return "opacity";
    if ("eas" == tag)
        return "easing";

    if ("w" == tag)
        return "width";

    if ("h" == tag)
        return "height";

    if ("sX" == tag)
        return "startX";
    if ("sY" == tag)
        return "startY";
    if ("eX" == tag)
        return "endX";
    if ("eY" == tag)
        return "endY";
    if ("lh" == tag)
        return "r9lineHeight";

    if ("flgspx" == tag)
        return "fillLinearGradientStartPointX";
    if ("flgspy" == tag)
        return "fillLinearGradientStartPointY";
    if ("flgepx" == tag)
        return "fillLinearGradientEndPointX";
    if ("flgepy" == tag)
        return "fillLinearGradientEndPointY";
    if ("flgcs" == tag)
        return "fillLinearGradientColorStops";
    if ("frgspx" == tag)
        return "fillRadialGradientStartPointX";
    if ("frgspy" == tag)
        return "fillRadialGradientStartPointY";
    if ("frgepx" == tag)
        return "fillRadialGradientEndPointX";
    if ("frgepy" == tag)
        return "fillRadialGradientEndPointY";
    if ("frgsr" == tag)
        return "fillRadialGradientStartRadius";
    if ("frger" == tag)
        return "fillRadialGradientEndRadius";
    if ("frgcs" == tag)
        return "fillRadialGradientColorStops";
    if ("fillp" == tag)
        return "fillPriority";
    if ("sox" == tag)
        return "shadowOffsetX";
    if ("soy" == tag)
        return "shadowOffsetY";
    if ("soxy" == tag)
        return "shadowOffset";
    if ("sob" == tag)
        return "shadowBlur";
    if ("sopc" == tag)
        return "shadowOpacity";
    if ("sdcl" == tag)
        return "shadowColor";
    if ("fwt" == tag)
        return "fontWeight";

    if ("uul" == tag)
        return "useUnderline";
    if ("crs" == tag)
        return "cornerRadius";
    if ("txo" == tag)
        return "textXOffset";
    if ("tyo" == tag)
        return "textYOffset";
    if ("fcs" == tag)
        return "fontColorStr";

    if ("rts" == tag)
        return "r9textstyle";

    if ( "bcs" == tag)
		return "borderColorStr";
	if ( "bgr" == tag ) 
		return "bgRed";
	if ( "bgg" == tag )
		return "bgGreen";
	if ( "bgb" == tag )
		return "bgBlue";
	if ( "bgal" == tag )
		return "bgAlpha";
	if ( "ac" == tag )
		return "anchor";
	if ( "acY" == tag )
		return "anchorY";
	if ( "acX" == tag )
		return "anchorX";
	if ( "lbt" == tag )
		return "lineBorderType";
    if ("bt" == tag)
         return "borderType";
	if ( "fcr" == tag )
		return "fillColor";
	if ( "scr" == tag )
		return "strokeColor";
	if ( "scx" == tag )
		return "scaleX";
	if ( "scy" == tag )
		return "scaleY";
	if ( "pos" == tag )
		return "position";
	if ( "bds" == tag )
		return "'bounds.size'";
	if ( "bdp" == tag )
		return "'bounds.point'";
	if ( "ubd" == tag )
		return "useBackground"; 
    
    
    return tag;
}

 

/** bookmark :    1,  or   name#1 */
function r9parseBookmark(bookmark, loc) {
    if (typeof bookmark === 'number') {
        return loc ? bookmark : '';
    }
    var bmfs = bookmark.split('#');
    if (loc) {
        return bmfs.length == 1 ? parseInt(bmfs[0]) : parseInt(bmfs[1]);
    } else {
        return bmfs.length == 1 ? "" : bmfs[0];
    }
}

;

var r9shrinktwm = function (obj, ttype, callback, layer) {
    if (typeof obj == 'undefined' || obj == null) return;
    if (ttype == 0)
        return new Kinetic.Tween({
            node: obj, scaleX: obj.scaleX() * 1.2, scaleY: obj.scaleY() * 0.8333, onFinish: function () {
                new Kinetic.Tween({
                    node: obj, scaleX: obj.scaleX() * 0.8333, scaleY: obj.scaleY() * 1.2, onFinish: function () {
                        new Kinetic.Tween({
                            node: obj, scaleX: obj.scaleX() * 1.2, scaleY: obj.scaleY() * 0.8333, onFinish: function () {
                                new Kinetic.Tween({
                                    node: obj, scaleX: obj.scaleX() * 0.8333, scaleY: obj.scaleY() * 1.2, onFinish: function () {
                                        if (callback) { callback(); }
                                    }, duration: 0.1
                                }).play();
                            }, duration: 0.1
                        }).play();
                    }, duration: 0.1
                }).play();
            }, duration: 0.1
        }).play();
    else if (ttype == 1) {
        if (typeof obj.x === "function" && typeof obj.width === "function") {
            var offX = obj.width() * obj.scaleX() * 0.1, offY = obj.height() * obj.scaleY() * 0.1,
                offX2 = obj.x(), offY2 = obj.y(),
                scaleX = obj.scaleX(), scaleY = obj.scaleY();
            return new Kinetic.Tween({
                node: obj, x: obj.x() - offX, y: obj.y() - offY, scaleX: scaleX * 1.2, scaleY: scaleY * 1.2, onFinish: function () {
                    new Kinetic.Tween({
                        node: obj, x: offX2, y: offY2, scaleX: scaleX, scaleY: scaleY, onFinish: function () {
                            new Kinetic.Tween({
                                node: obj, x: obj.x() - offX, y: obj.y() - offY, scaleX: scaleX * 1.2, scaleY: scaleY * 1.2, onFinish: function () {
                                    new Kinetic.Tween({
                                        node: obj, x: offX2, y: offY2, scaleX: scaleX, scaleY: scaleY, onFinish: function () {
                                            if (callback) { callback(); }
                                        }, duration: 0.1
                                    }).play();
                                }, duration: 0.1
                            }).play();
                        }, duration: 0.1
                    }).play();
                }, duration: 0.1
            }).play();
        } else {
            var offX = obj.width * obj.scaleX() * 0.1, offY = obj.height * obj.scaleY() * 0.1,
                offX2 = obj.x, offY2 = obj.y,
                scaleX = obj.scaleX(), scaleY = obj.scaleY();
            return new Kinetic.Tween({
                node: obj, x: obj.x - offX, y: obj.y - offY, scaleX: scaleX * 1.2, scaleY: scaleY * 1.2, onFinish: function () {
                    new Kinetic.Tween({
                        node: obj, x: offX2, y: offY2, scaleX: scaleX, scaleY: scaleY, onFinish: function () {
                            new Kinetic.Tween({
                                node: obj, x: obj.x - offX, y: obj.y - offY, scaleX: scaleX * 1.2, scaleY: scaleY * 1.2, onFinish: function () {
                                    new Kinetic.Tween({
                                        node: obj, x: offX2, y: offY2, scaleX: scaleX, scaleY: scaleY, onFinish: function () {
                                            if (callback) { callback(); }
                                        }, duration: 0.1
                                    }).play();
                                }, duration: 0.1
                            }).play();
                        }, duration: 0.1
                    }).play();
                }, duration: 0.1
            }).play();
        }

    } else if (ttype == 2 && (typeof layer != 'undefined')) {
        return new Kinetic.Tween({
            node: obj, duration: 0.1,
            onFinish: function () {
                var anim = new Kinetic.Animation(function (frame) {
                    obj.rotate(90 * frame.timeDiff / 1000); if (frame.time > 500) anim.stop();
                }, layer); anim.start();
            }
        }).play();
    } else if (ttype == 3 && (typeof layer != 'undefined')) {
        var xoff0 = obj.width() * obj.scaleX() * 0.25, xoff1 = obj.x();
        return new Kinetic.Tween({
            node: obj, x: xoff1 - xoff0, scaleX: obj.scaleX() * 1.5, scaleY: obj.scaleY() * 1.5, onFinish: function () {
                new Kinetic.Tween({
                    node: obj, duration: 1, onFinish: function () {
                        new Kinetic.Tween({
                            node: obj, x: xoff1, scaleX: obj.scaleX() * 0.666, scaleY: obj.scaleY() * 0.666, onFinish: function () {
                                if (callback) { callback(); }
                            }, duration: 0.3
                        }).play();
                    }
                }).play();
            }, duration: 0.3
        }).play();
    } else
        return new Kinetic.Tween({ node: obj , onFinish: function(){  if (callback) { callback(); }  }}).play();
}

//remove object tween
//etype: 13 random, 9 flip 10 curlright  11 curdown  1 enlarge 2 shrink 3-4 updown 5-6 left-right
var r9twnrm = function (obj, dur, etype, easingname) {
    if (typeof obj == 'undefined' || obj == null)
        return;
    etype = etype || 0;
    easingname = easingname || 'Linear';
    if (easingname === 'Shrinking') {
        var tween = r9shrinktwm(obj, 0, function () { r9twnrm(tweens, obj, dur, etype, 'Linear') });
      // if (tween) tween.play();
        return;
    }
    easingname = Kinetic.Easings[easingname];

    if (etype == 13) etype = Math.floor(Math.random() * 10);
    if (etype == 0)
        new Kinetic.Tween({
            node: obj, opacity: 0.8, strokeAlpha: 0.5, onFinish: function () {
                obj.dash([3, 3]);
                new Kinetic.Tween({ node: obj, opacity: 0, strokeAlpha: 0, onFinish: function () { obj.remove(); }, duration: dur * 0.8 }).play();
            }, duration: dur * 0.2
        }).play();
    else if (etype == 5 || etype == 6) { //to left
        var x = etype == 1 ? (obj.x() || -500) : (obj.x ? 1000 - obj.x : 1000);
        new Kinetic.Tween({
            node: obj, x: x,
            onFinish: function () { obj.remove(); }, duration: dur, easing: easingname
        }).play();
    }
    else if (etype == 3 || etype == 4) { //to up
        var y = etype == 3 ? (obj.x() || -500) : (obj.x ? 1000 - obj.x : 1000);
        new Kinetic.Tween({
            node: obj, y: y,
            onFinish: function () { obj.remove(); }, duration: dur, easing: easingname
        }).play();
    }
    else if (etype == 1 || etype == 2) { //to scale
        var s = etype == 5 ? 9 : 0.00001;
        new Kinetic.Tween({
            node: obj, scaleX: s, scaleY: s,
            onFinish: function () { obj.remove(); }, duration: dur, easing: easingname
        }).play();
    }
    else if (etype == 9) { //to flip
        var s = 0.00001;
        var x = obj.getX() + obj.getWidth() / 2;
        new Kinetic.Tween({
            node: obj, scaleX: s, x: x,
            onFinish: function () { obj.remove(); }, duration: dur, easing: easingname
        }).play();
    }
    else if (etype == 10) { //to curlRight
        var s = 0.00001;
        new Kinetic.Tween({
            node: obj, scaleX: s,
            onFinish: function () { obj.remove(); }, duration: dur, easing: easingname
        }).play();
    }
    else if (etype == 11) { //to curlDown
        var s = 0.00001;
        new Kinetic.Tween({
            node: obj, scaleY: s,
            onFinish: function () { obj.remove(); }, duration: dur, easing: easingname
        }).play();
    } else {
        new Kinetic.Tween({
            node: obj, opacity: 0.1,
            onFinish: function () { obj.remove(); }, duration: dur, easing: easingname
        }).play();
    }
}

var tween_r9figure = function (node, properties) {
    var newpropertis = { node: node };
    for (var key in properties) {
        newpropertis[fromShortTag(key)] = properties[key];
    }
    return new Kinetic.Tween(newpropertis);
}

var r9tween = function (tweens, properties, useobj) {
    if (!useobj) {
        var newpropertis = {};
        // newpropertis[node] = id;
        for (var key in properties) {
            if (key == 'node' && !properties[key])
                return;
            newpropertis[fromShortTag(key)] = properties[key];
        }
        tweens.push(new Kinetic.Tween(newpropertis));
    }
    else
        tweens.push(properties);
}

var r9tween2 = function (tweens, obj, useobj) {
    if (obj)
        r9tween(tweens, { node: obj, opa: 1, dur: 1 }, useobj);
}

var r9indi_rotate = function (node, config, ptimer) {
    var dur = config.dur, stime = config.stime, cx = config.cx,
        cy = config.cy, angle = config.angle;
    ptimer.addAni(node, function (progress, duration, times) {
        node.setAnchorX(cx);
        node.setAnchorY(cy);
        node.setRotation(angle * progress);
    }, stime, dur, true, 0, false, function () { });
}

var r9indi_movealongpath = function (node, alongpath, config, ptimer) {
    var dur = config.dur, stime = config.stime, pathStr = alongpath.toPathString(),
        pathdata = alongpath.toPathData(), cxt = ptimer.layer.getContext();
    var path = new Kinetic.Path({
        x: 0,
        y: 0,
        data: pathStr,
        opacity: 0
    });
    var length = Kinetic.Util.getPathDataLength(pathdata);
    ptimer.addAni(node, function (progress, duration, times) {
        if (path.parent == null) {
            ptimer.layer.add(path);
        }
        var p = Kinetic.Util.getPointAt(pathdata, length * progress);
        node.setX(p.x);
        node.setY(p.y);
    }, stime, dur, true, 0, false, function () {
        path.remove();
    });
};
var PIXEL_RATIO = (function () {
    var ctx = document.createElement("canvas").getContext("2d"),
        dpr = window.devicePixelRatio || 1,
        bsr = ctx.webkitBackingStorePixelRatio ||
            ctx.mozBackingStorePixelRatio ||
            ctx.msBackingStorePixelRatio ||
            ctx.oBackingStorePixelRatio ||
            ctx.backingStorePixelRatio || 1;
    return dpr / bsr;
})();

var openExtraR9Browser = function (url) {
    if ((typeof r9baseurl !== 'undefined') && (url.slice(0, 4) != "http")) {
        url = r9baseurl + "/" + url;
    }
    window.open('' + url, 'mywin', 'left=20,top=20,width=500,height=500,toolbar=1,resizable=1,scrollbars=1');
}

var speakText_notts = function (pos, pageid, prefix, text, langCode, resumeAfterTTs, rate, topicId, subtopic, callback, ttsNoBlkAni) {
	   var extime = 0;
       if (langCode == "zh" || langCode == "zh_CN") {
           extime = text.replace(/\\s*/g, '').length * 0.2174 * 1000;
       } else {
           extime = text.split(/[\\s,.]+/).length * 0.4162 * 1000;
       }
       if(extime < 1000 ) extime = 1000;

       function _nottswait(cdown) {
           if (cdown < 0) {
               if (resumeAfterTTs) { r9.PageBus.publish(  "r9.core.animation.resume", {'prefix': prefix,  'messageid': -1, 'pos': pos }); }
               if (topicId) { r9.PageBus.publish("r9.core.event.broadcast", { 'prefix': prefix, 'pageid': pageid, 'pos': pos, 'topic': topicId , 'subtopic' : subtopic}); }
               if (callback) callback();
               endSpeakInPage();
               return;
           }
           if (!ttsNoBlkAni ) { r9.markr9times(); } window.setTimeout(function () { _nottswait(cdown - 500); }, 500);
       }
       _nottswait(extime);
}

var speakText = function (pos, page , prefix, text, langCode, resumeAfterTTs, rate, topicId, subtopic, callback, ttsNoBlkAni) {
	ttsNoBlkAni =   ttsNoBlkAni || false;
    var usetts = 'speechSynthesis' in window;
    if( usetts ){
    	var syn = window.speechSynthesis;
      //  if (syn.speaking || syn.paused || syn.pending) {
        	syn.cancel();
     //   }
        	
        	langCode = ((langCode == 'zh' || langCode == 'zh_CN') ? 'zh-CN' : langCode);
      
        	//for chrome, it no longer support remote voice in china, 
        	//so we need to check it
       var isChrome =/Chrome/.test(navigator.userAgent) &&/Google Inc/.test(navigator.vendor);
       if( isChrome && langCode != 'zh-CN' ){
    	   usetts = false; 
       	   speakText_notts(pos, page.pageid, prefix, text, langCode, resumeAfterTTs, rate, topicId, subtopic, callback, ttsNoBlkAni);
       	   return;
       }
//       if( isChrome ){
//    	   if( !window._r9ttsconifg )  window._r9ttsconfig = {};
//           if(  typeof window._r9ttsconif[langCode] == 'undefined' ){
//           	  var voices = speechSynthesis.getVoices();
//   	       	  if (voices.length) {
//   	       	      voice.forEach(function(n){
//   	       	    	  //TODO ? 
//   	       	      });
//   	       	  } else {
//   	       		   speechSynthesis.onvoiceschanged = function() {
//   	             	    voices = speechSynthesis.getVoices();
//   	             	    console.log(voices);
//   	               };
//   	       	  }
//           }
//       }
      
        	 

        page.ssu = new SpeechSynthesisUtterance(text); 
        page.ssu.lang = langCode ;
        if (rate) {
        	page.ssu.rate = rate;
        }
        page.ssu.onerror = function (event) { 
        //	console.log("onerror " + text)
        	usetts = false; 
        	speakText_notts(pos, page.pageid, prefix, text, langCode, resumeAfterTTs, rate, topicId, subtopic, callback, ttsNoBlkAni);
        //	endSpeakInPage();
        //	if (resumeAfterTTs) { 
        //		r9.PageBus.publish(  "r9.core.animation.resume", { 'prefix':prefix, 'messageid': -1, 'pos': pos }); } 
        };
        page.ssu.onend = function (event) { 
        //	console.log("onend " + text)
        	usetts = false; 
            if (resumeAfterTTs) { r9.PageBus.publish(  "r9.core.animation.resume", { 'prefix':prefix, 'messageid': -1, 'pos': pos }); }
            if (topicId) { r9.PageBus.publish("r9.core.event.broadcast", { 'prefix': prefix, 'pageid': page.pageid,  'pos': pos, 'topic': topicId, 'subtopic': subtopic }); }
            if (callback) callback();
            endSpeakInPage();
        };
//        page.ssu.onpause = function (event) { 
//        	console.log("pause " + text)
//        };
//        page.ssu.onboundary = function (event) { 
//        	console.log("onboundary " + text)
//        };
//        page.ssu.onmark = function (event) { 
//        	console.log("onmark " + text)
//        };
//        page.ssu.onstart = function (event) { 
//        	console.log("onstart " + text)
//        };
//        page.ssu.onresume = function (event) { 
//        	console.log("onresume " + text)
//        };
        syn.speak(page.ssu); 

        function _wait(count) {
        	if( !usetts ) return;
            if (!syn.speaking || syn.paused || syn.pending ) {  
                return;
            }
            if (!ttsNoBlkAni ) { r9.markr9times(); }
            window.setTimeout(_wait, 500);
        }
        _wait();
    }
    else {
    	speakText_notts(pos, page.pageid, prefix, text, langCode, resumeAfterTTs, rate, topicId, subtopic, callback, ttsNoBlkAni);
    } 
}

var startSpeakInPage = function (page, silent) {
    if (page) {
        page.mdstarted = true;
    }
    if (!silent)
        r9.PageBus.publish('r9.core.action.speak', { 'speak': true });
}
var endSpeakInPage = function (page) {
    r9.PageBus.publish('r9.core.action.speak', { 'speak': false });
}

var getCacheR9AudioFile = function (audiofilename) {
    if (window.HTMLAudioElement) {
        try {
            var oAudio = document.getElementById('r9audioplayer');

            if (oAudio && oAudio.src == audiofilename) {
                return oAudio;
            }
            var oAudio1 = document.getElementById('r9audioplayer1');
            if (oAudio1 && oAudio1.src == audiofilename) {
                return oAudio1;
            }
        }
        catch (e) {
            r9_log_console(e);
        }
        return null;
    }
}
var cachedR9AudioFile = null;
var cacheR9AudioFile = function (audiofilename) {
    if (!navigator.onLine || r9.baiduerror) {
        return;
    }
    if (window.HTMLAudioElement) {
        try {
            var oAudio = document.getElementById('r9audioplayer');
            var oAudio1 = document.getElementById('r9audioplayer1');
            if (oAudio && oAudio.paused && (oAudio1 == cachedR9AudioFile || cachedR9AudioFile == null)) {
                oAudio.src = audiofilename;
                oAudio.load();
                cachedR9AudioFile = oAudio;
                return;
            }
            if (oAudio1 && oAudio1.paused && (cachedR9AudioFile == null || cachedR9AudioFile == oAudio)) {
                oAudio1.src = audiofilename;
                oAudio1.load();
                cachedR9AudioFile = oAudio1;
                return;
            }
        }
        catch (e) {
            r9_log_console(e);
        }
    }
}


var playR9AudioFile = function (audiofilename, blockanimation, page) {
    /** Check for audio element support. */
    if (window.HTMLAudioElement) {
        try {
            r9.r9rqstRter.addRqst();
            var oAudio = document.getElementById('r9audioplayer');
            var oAudio1 = document.getElementById('r9audioplayer1');
            if (oAudio && (oAudio.paused || oAudio.ended || oAudio.error) && oAudio.src == audiofilename) {
                playR9AudioFile2(oAudio, blockanimation, page);  //if (oAudio1 ){  oAudio1.pause(); }  return;
            }
            else if (oAudio1 && (oAudio1.paused || oAudio1.ended || oAudio1.error) && oAudio1.src == audiofilename) {
                playR9AudioFile2(oAudio1, blockanimation, page);  //if (oAudio ){  oAudio.pause(); }  return;
            }
            else if (oAudio.paused || oAudio.ended || oAudio.error) {
                oAudio.src = audiofilename;
                playR9AudioFile2(oAudio, blockanimation, page);  //if (oAudio1 ){  oAudio1.pause(); } return;
            }
            else if (oAudio1 && (oAudio1.paused || oAudio1.ended || oAudio1.error)) {
                oAudio1.src = audiofilename;
                playR9AudioFile2(oAudio1, blockanimation, page); //if (oAudio ){  oAudio.pause(); } return;
            }
            else {
                oAudio.pause();
                oAudio.src = audiofilename;
                playR9AudioFile2(oAudio, blockanimation, page);
            }

            // oAudio.pause();
            // if (oAudio1 ){  oAudio1.pause(); }
            // if( page ) { page.mdstarted = true; }
        }
        catch (e) {
            /**  Fail silently but show in F12 developer tools console */
            r9_log_console(e);
            r9.r9rqstRter.removeRqst();
            startSpeakInPage(page);
        }
    } else {
        startSpeakInPage(page);
    }
}



var playR9AudioFile2 = function (oAudio, blockanimation, page) {
    try {
        var firstTime = true;
        function _wait(count) {
            if (oAudio.played) {
                if (firstTime) { firstTime = false; r9.r9rqstRter.removeRqst(); startSpeakInPage(page); }
            }
            if (oAudio.paused || oAudio.error || oAudio.ended) {
                endSpeakInPage();
                return;
            }
            if (blockanimation) { r9.markr9times(); }
            window.setTimeout(_wait, 500);
        }

        var playPromise = oAudio.play();
        if (playPromise !== undefined) {
            playPromise.then(function () { _wait(); }, function () { startSpeakInPage(page, true); });
        } else {
            _wait();
        }
    }
    catch (e) {
        /**  Fail silently but show in F12 developer tools console */
        r9_log_console(e);
        r9.r9rqstRter.removeRqst();
        startSpeakInPage(page);
    }
}

var exitVideoPaneIOS = function () {
    var elements = document.getElementsByClassName("video_container_class")
    var j = elements.length;
    while (--j >= 0) {
        var current = elements[j];
        if (current.style.setProperty) {
            current.style.setProperty("top", "2048px", null);
        }
        else {
            current.style.setAttribute("top", "2048px");
        }
    }
    elements = document.getElementsByTagName("video")
    var j = elements.length;
    while (--j >= 0) {
        var current = elements[j];
        current.pause();
    }

    var node = document.getElementById("video_overlay_container");

    if (node.style.setProperty) {
        node.style.setProperty("display", "none", null);
    }
    else {
        node.style.setAttribute("display", "none");
    }

}

var createVideoPaneIOS = function (videoContainerId, sourceUrl) {
    var node = document.getElementById(videoContainerId);

    if (node.style.setProperty) {
        node.style.setProperty("top", "50%", null);
    }
    else {
        node.style.setAttribute("top", "50%");
    }


    node = document.getElementById("video_overlay_container");
    if (node.style.removeProperty) {
        node.style.removeProperty("display");
    }
    else {
        node.style.removeAttribute("display");
    }
}

var exitVideoPane = function () {
    var node = document.getElementById("video_container");
    while (node.hasChildNodes()) {
        node.removeChild(node.lastChild);
    }
    if (node.style.setProperty) {
        node.style.setProperty("display", "none", null);
    }
    else {
        node.style.setAttribute("display", "none");
    }

    node = document.getElementById("video_overlay_container");

    if (node.style.setProperty) {
        node.style.setProperty("display", "none", null);
    }
    else {
        node.style.setAttribute("display", "none");
    }

}


var createVideoPane = function (sourceUrl) {
    var node = document.getElementById("video_container");

    if (node.style.removeProperty) {
        node.style.removeProperty("display");
    }
    else {
        node.style.removeAttribute("display");
    }

    var videoEle = document.createElement("VIDEO");
    videoEle.setAttribute("preload", "preload");
    videoEle.setAttribute("controls", "controls");
    videoEle.setAttribute("src", sourceUrl);
    node.appendChild(videoEle);


    node = document.getElementById("video_overlay_container");
    if (node.style.removeProperty) {
        node.style.removeProperty("display");
    }
    else {
        node.style.removeAttribute("display");
    }
}
var convertCanvasToImage = function (canvas) {

    var image = new Image();

    image.src = canvas.toDataURL();
    return image;
};var _mask_k_getImageBoxes = function (onode, topleft, kimage) {
    if (!kimage)
        return [];
    var _m_boxCols = 10;
    var _m_boxRows = 10;
    var kiw = kimage.width;
    if (kiw >= 800) _m_boxCols = 20;
    else if (kiw > 600) _m_boxCols = 18;
    else if (kiw > 400) _m_boxCols = 16;
    else if (kiw > 200) _m_boxCols = 14;
    else if (kiw > 100) _m_boxCols = 12;
    kiw = kimage.height;
    if (kiw >= 800) _m_boxRows = 20;
    else if (kiw > 600) _m_boxRows = 18;
    else if (kiw > 400) _m_boxRows = 16;
    else if (kiw > 200) _m_boxRows = 14;
    else if (kiw > 100) _m_boxRows = 12;

    var boxList = [];
    var boxWidth = Math.round(kimage.width / _m_boxCols),
        boxHeight = Math.round(kimage.height / _m_boxRows);
    for (var rows = 0; rows < _m_boxRows; rows++) {
        for (var cols = 0; cols < _m_boxCols; cols++) {
            var nimage = new Kinetic.SImage({
                image: kimage,
                x: (topleft.x), // onode.x()+ "+MASK_XOFFSET+" ),
                width: kimage.width,
                y: (topleft.y),
                height: kimage.height,
                scaleX: topleft.scaleX,
                scaleY: topleft.scaleY
            });

            if (cols === _m_boxCols - 1) {
                nimage.cropX(boxWidth * cols);
                nimage.cropY(boxHeight * rows);
                nimage.cropWidth(kimage.width - boxWidth * cols);
                nimage.cropHeight(boxHeight);
            } else {

                nimage.cropX(boxWidth * cols);
                nimage.cropY(boxHeight * rows);
                nimage.cropWidth(boxWidth);
                nimage.cropHeight(boxHeight);
            }
            boxList.push(nimage);
        }
    }
    return { list: boxList, width: boxWidth, height: boxHeight, cols: _m_boxCols, rows: _m_boxRows };
}

var _mask_getImageStrips = function (onode, topleft, kimage, horizontal) {
    if (!kimage)
        return [];
    var _m_boxCols = 5;
    var _m_boxRows = 5;
    var boxWidth, boxHeight;
    var boxList = [];
    var kiw = horizontal ? kimage.width : kimage.height;
    if (kiw >= 800) _m_boxCols = 40;
    else if (kiw > 600) _m_boxCols = 35;
    else if (kiw > 400) _m_boxCols = 25;
    else if (kiw > 200) _m_boxCols = 16;
    else if (kiw > 100) _m_boxCols = 12;
    else _m_boxCols = 8;
    if (horizontal) {
        var imgwidth = kimage.width;
        boxWidth = Math.round(imgwidth / _m_boxCols),
            boxHeight = Math.round(kimage.height);

        if (Math.random() > 0.3) {
            var curx = 0, curw = 2, fright = Math.random() > 0.5;
            if (fright) curx = imgwidth - curw;
            while (curx < imgwidth && curx >= 0) {
                var nimage = new Kinetic.SImage({
                    image: kimage,
                    x: (topleft.x),  //\n") ;//onode.x() +"+MASK_XOFFSET+" ),  
                    width: imgwidth,
                    y: (topleft.y),
                    height: kimage.height,
                    scaleX: topleft.scaleX,
                    scaleY: topleft.scaleY
                });

                curw += 1;
                if (!fright) {
                    if (curx + curw > imgwidth) {
                        curw = imgwidth - curx;
                    }
                }

                nimage.cropX(curx);
                nimage.cropY(0);
                nimage.cropWidth(curw);
                nimage.cropHeight(boxHeight);
                boxList.push(nimage);
                if (fright) {
                    if (curx > 0 && curx < curw) {
                        curw = curx;
                        curx = 0;
                    } else {
                        curx -= curw;
                    }
                } else
                    curx += curw;
            }
        } else {

            for (var cols = 0; cols < _m_boxCols; cols++) {
                var nimage = new Kinetic.SImage({
                    image: kimage,
                    x: (topleft.x), // onode.x() +"+MASK_XOFFSET+"),
                    width: imgwidth,
                    y: (topleft.y),
                    height: kimage.height,
                    scaleX: topleft.scaleX,
                    scaleY: topleft.scaleY
                });

                if (cols === _m_boxCols - 1) {
                    nimage.cropX(boxWidth * cols);
                    nimage.cropY(0);
                    nimage.cropWidth(kimage.width - boxWidth * cols);
                    nimage.cropHeight(boxHeight);
                } else {
                    nimage.cropX(boxWidth * cols);
                    nimage.cropY(0);
                    nimage.cropWidth(boxWidth);
                    nimage.cropHeight(boxHeight);
                }
                boxList.push(nimage);
            }
        }
    } else {
        _m_boxRows = _m_boxCols;
        boxWidth = Math.round(kimage.width),
            boxHeight = Math.round(kimage.height / _m_boxRows);
        for (var rows = 0; rows < _m_boxRows; rows++) {
            var nimage = new Kinetic.SImage({
                image: kimage,
                x: (topleft.x),// onode.x() +"+MASK_XOFFSET+" ),
                width: kimage.width,
                y: (topleft.y),
                height: kimage.height,
                scaleX: topleft.scaleX,
                scaleY: topleft.scaleY
            });

            if (rows === _m_boxRows - 1) {
                nimage.cropX(0);
                nimage.cropY(boxHeight * rows);
                nimage.cropWidth(boxWidth);
                nimage.cropHeight(kimage.height - boxHeight * rows);
            } else {
                nimage.cropX(0);
                nimage.cropY(boxHeight * rows);
                nimage.cropWidth(boxWidth);
                nimage.cropHeight(boxHeight);
            }
            boxList.push(nimage);
        }
    }

    return { list: boxList, width: boxWidth, height: boxHeight, cols: _m_boxCols, rows: _m_boxRows };
}


var _mask_r9ImgBgTransMask = function (alay, kimage, topleft, duration, transType, kimage2, duration2, transType2, useForground) {
    // kimage for delete, kimage2 for add. we treat delay delete
    // separately.
    var callback = {};
    var count = 2;
    if (!kimage || transType == 11)
        count--;
    if (!kimage2)
        count--;
    if (count <= 0)
        return;
    callback.onStart = function () { };
    callback.onEnd = function () {
        count--;
        if (count == 0) {
            if (transType == 11) {
                kimage.remove();
            }
            if (useForground) {
                alay.moveDown();
            }
        }
    };
    if (useForground) {
        alay.moveUp();
    }
    if (transType != 11 && kimage) { // delay delete
        _mask_k_handleImageTransition2(alay, kimage, topleft, kimage.image(), 0, duration, transType, false, true, callback);
    }
    if (kimage2) {
        _mask_k_handleImageTransition2(alay, kimage2, topleft, kimage2.image(), 0, duration2, transType2, true, false, callback);
    }
}

var _mask_k_handleImageTransition = function (contentlay, onode, topleft, duration, transitionType, isCreation, removeNode, callback) {
    var offset = 0;// 2000;
    onode.toImage({
        x: isCreation ? topleft.x - offset : topleft.x,
        y: topleft.y,
        callback: function (image) {
            _mask_k_handleImageTransition2(contentlay, onode, topleft, image, offset, duration, transitionType, isCreation, removeNode, callback);
        }
    });
}

var _mask_k_handleImageTransition2 = function (contentlay, onode, topleft, image, xoffset, duration, transitionType, isCreation, removeNode, callback) {
    var boxList, boxWidth, boxHeight, result;
    var _m_boxCols = 5;
    var _m_boxRows = 5;

    //       var aimage = new Kinetic.SImage( { 
    //	      image : image, 
    //	          x : ( topleft.x ), // onode.x()+ "+MASK_XOFFSET+" ),
    //		      width : image.width, 
    //		      y : ( topleft.y ), 
    //		     height : image.height,  
    //		     }); 
    //       contentlay.add(aimage);
    //       contentlay.draw();
    //       return;

    topleft.scaleX = onode.width() / image.width;
    topleft.scaleY = onode.height() / image.height;

    if (transitionType < 7 || transitionType == 12) {
        result = _mask_k_getImageBoxes(onode, topleft, image);
    } else if (transitionType == 7 || transitionType == 8) {
        result = _mask_getImageStrips(onode, topleft, image, transitionType == 7);
    } else if (transitionType == 11) {  // delay
        result = { list: [], width: 1, height: 1, cols: 0, rows: 0 };
    } else {
        return;
    }



    boxList = result.list;
    boxWidth = result.width;
    boxHeight = result.height;
    _m_boxCols = result.cols;
    _m_boxRows = result.rows;
    var size = boxList.length;
    var tweens = [];
    var finished = false;

    var newCallback = {};
    newCallback.onSuccess = function (removenimages) {
        size--;;
        if (!finished && size <= 0) {
            finished = true;
            if (isCreation) {
                if (xoffset == 0)
                    contentlay.add(onode); //SImage
                else
                    onode.x(onode.x() + xoffset);
                if (!callback) {
                    onode.setZIndex(1);
                }
            }


            if (callback) {
                callback.onEnd();
            }
            if (removenimages) {
                for (var b = 0; b < boxList.length; b++) {
                    var nimage = boxList[b];
                    nimage.remove();
                }
            }
        }
    };

    if (transitionType == 11) {// delay delete
        setTimeout(function () { if (removeNode) { onode.remove(); } else { onode.opacity(0); } newCallback.onSuccess(); }, duration);
        return;
    }

    for (var b = 0; b < size; b++) {
        var nimage = boxList[b];
        var offsetx = 0, offsety = 0;
        if (isCreation) {
            if (transitionType < 7 || transitionType == 12) {
                nimage.setCropWidth(1);
                nimage.setCropX(nimage.getCropX() + boxWidth / 2);
                nimage.setCropHeight(1);
                nimage.setCropY(nimage.getCropY() + boxHeight / 2);
            }
            if (transitionType == 12) {
                offsetx = image.width * 2 * (0.5 - Math.random());
                offsety = image.height * 2 * (0.5 - Math.random());
                nimage.setX(nimage.getX() + offsetx);
                nimage.setY(nimage.getY() + offsety);
            }
            if (transitionType == 7) {
                nimage.setCropWidth(1);
            }
            if (transitionType == 8) {
                nimage.setCropHeight(1);
            }
        } else {
            if (transitionType == 12) {
                offsetx = image.width * 2 * (0.5 - Math.random());
                offsety = image.height * 2 * (0.5 - Math.random());
            }
        }
        contentlay.add(nimage);
        var tweenwrap = function (nimage) {
            if (transitionType < 7)
                return new Kinetic.Tween({
                    node: nimage,
                    opacity: isCreation ? 1 : 0.1,
                    cropX: isCreation ? nimage.getCropX() - boxWidth / 2 : 0.1,
                    cropY: isCreation ? nimage.getCropY() - boxHeight / 2 : 0.1,
                    cropWidth: isCreation ? boxWidth : 0.1,
                    cropHeight: isCreation ? boxHeight : 0.1,
                    easing: Kinetic.Easings['Linear'],
                    onFinish: function () {
                        newCallback.onSuccess(true);
                    },
                    duration: duration
                });
            else if (transitionType == 12)
                return new Kinetic.Tween({
                    node: nimage,
                    opacity: isCreation ? 1 : 0.0,
                    cropX: isCreation ? nimage.getCropX() - boxWidth / 2 : 0,
                    cropY: isCreation ? nimage.getCropY() - boxHeight / 2 : 0,
                    x: nimage.getX() - offsetx,
                    y: nimage.getY() - offsety,
                    cropWidth: isCreation ? boxWidth : 0,
                    cropHeight: isCreation ? boxHeight : 0,
                    easing: Kinetic.Easings['Linear'],
                    onFinish: function () {
                        newCallback.onSuccess(true);
                    },
                    duration: duration
                });
            else if (transitionType == 7) {
                return new Kinetic.Tween({
                    node: nimage,
                    opacity: isCreation ? 1 : 0.0,
                    cropWidth: isCreation ? boxWidth : 0.0,
                    easing: Kinetic.Easings['Linear'],
                    onFinish: function () {
                        // nimage.remove();
                        newCallback.onSuccess(true);
                    },
                    duration: duration
                });
            }
            else if (transitionType == 8) {
                return new Kinetic.Tween({
                    node: nimage,
                    opacity: isCreation ? 1 : 0.0,
                    cropHeight: isCreation ? boxHeight : 0,
                    easing: Kinetic.Easings['Linear'],
                    onFinish: function () {
                        // nimage.remove();
                        newCallback.onSuccess(true);
                    },
                    duration: duration
                });
            }
        };
        tweens.push(tweenwrap(nimage));
    }
    if (!isCreation && transitionType != 11) {
        if (removeNode) { onode.remove(); } else { onode.opacity(0); }
    }
    if (callback) {
        callback.onStart();
    }
    contentlay.batchDraw();

    if (transitionType == 0 || transitionType == 7 || transitionType == 8 || transitionType == 12) {
        for (var b = 0; b < size; b++) { // box, same time
            tweens[b].play();
        }
    } else if (transitionType == 1) { // box random
        this._mask_k_handleBoxRandomChange(tweens);
    } else if (transitionType == 2) { // box topleft to
        // bottomright
        if (_m_boxRows > _m_boxCols)
            this._mask_handleBoxTopleftToBottomright1(tweens, 0, _m_boxRows, _m_boxCols);
        else
            this._mask_handleBoxTopleftToBottomright1(tweens, 0, _m_boxCols, _m_boxRows);
    } else if (transitionType >= 3 || transitionType <= 6) {
        //3: left-right 4: right-left 5: top-down  6: down-top
        var is_hori = false, left_top = false, start_pos = 0;
        if (transitionType == 3) { is_hori = true; left_top = true; start_pos = -1; }
        if (transitionType == 4) { is_hori = true; left_top = false; start_pos = _m_boxCols; }
        if (transitionType == 5) { is_hori = false; left_top = true; start_pos = -1; }
        if (transitionType == 6) { is_hori = false; left_top = false; start_pos = _m_boxRows; }

        this._mask_handleBoxOneDirection(tweens, start_pos, is_hori, left_top, _m_boxRows, _m_boxCols);
    }
}


var _mask_k_handleBoxRandomChange = function (tweens) {
    var m = this;
    var batch = 6;
    var size = tweens.length;
    if (size == 0) return;
    while (batch > 0 && size > 0) {
        var index = Math.floor(Math.random() * size);
        var tween = tweens[index];
        tween.play();
        tweens.splice(index, 1);

        size = tweens.length;
        batch--;
    }
    setTimeout(function () { m._mask_k_handleBoxRandomChange(tweens); }, 10);
}




var _mask_handleBoxTopleftToBottomright1 = function (tweens, colIndex, _m_boxRows, _m_boxCols) {
    if (colIndex >= _m_boxCols) { _mask_handleBoxTopleftToBottomright2(tweens, 0, _m_boxRows, _m_boxCols); return; }
    var m = this;
    for (var col = 0; col <= colIndex; col++) {
        var row = colIndex - col;
        var index = row * _m_boxCols + col;
        if (index < tweens.length) {
            var tween = tweens[index];
            tween.play();
        }
    }
    setTimeout(function () { m._mask_handleBoxTopleftToBottomright1(tweens, colIndex + 1, _m_boxRows, _m_boxCols); }, 100)
}



var _mask_handleBoxTopleftToBottomright2 = function (tweens, rowIndex, _m_boxRows, _m_boxCols) {
    if (rowIndex >= _m_boxRows) return;
    var m = this;
    for (var row = rowIndex; row < _m_boxRows; row++) {
        var col = _m_boxRows - 1 + rowIndex - row;
        var index = row * _m_boxCols + col;
        if (index < tweens.length) {
            var tween = tweens[index];
            tween.play();
        }
    }
    setTimeout(function () { m._mask_handleBoxTopleftToBottomright2(tweens, rowIndex + 1, _m_boxRows, _m_boxCols); }, 100)
}

var _mask_handleBoxOneDirection = function (tweens, curIndex, is_hor, left_top, _m_boxRows, _m_boxCols) {
    var m = this;
    var needPlays = [];
    if (is_hor) { // left to right
        curIndex = left_top ? curIndex + 1 : curIndex - 1;
        if (curIndex < 0 || curIndex >= _m_boxRows) return;
        for (var row = 0; row < _m_boxRows; row++) {
            var index = row * _m_boxCols + curIndex;
            if (index < tweens.length) {
                needPlays.push(tweens[index]);
            }
        }
    }
    else {// up down
        curIndex = left_top ? curIndex + 1 : curIndex - 1;
        if (curIndex < 0 || curIndex >= _m_boxCols) return;
        for (var col = 0; col < _m_boxCols; col++) {
            var index = curIndex * _m_boxCols + col;
            if (index < tweens.length) {
                needPlays.push(tweens[index]);
            }
        }
    }


    if (needPlays.length > 0) {
        for (var i = 0; i < needPlays.length; i++)
            needPlays[i].play();
        setTimeout(function () {
            m._mask_handleBoxOneDirection(tweens,
                curIndex, is_hor, left_top, _m_boxRows, _m_boxCols);
        }, 100);
    }
}  ;
var r9indi_morphing = function (from, to, config, ptimer, isCreation) {
    var dur = config.dur, stime = config.stime, fill_color = config.fill_color, stroke_color = config.stroke_color,
        closed = config.closed, frompathStr = config.frompathStr,
        topathStr = config.topathStr,
        cxt = ptimer.layer.getContext();
    var path = new Kinetic.Path({
        data: frompathStr,
        stroke: stroke_color,
        fill: fill_color,
        todata: topathStr,
        tofill: config.tofill,
        tostroke: config.tostroke
    });
    path.forceClose = closed;

    ptimer.addAni(to, function (progress, duration, times) {
        if (path.parent == null) {
            ptimer.layer.add(path);
            path.startMorph();
        }
        path.renderMorphStep(progress);
    }, stime, dur, true, 0, false, function () {
        if (isCreation) {
            tween_r9figure(to, {
                opa: 1.0, dur: 0.1, onFinish: function () {
                    path.remove();
                }
            }).play();
        }
        else {
            path.remove();
        }
    });
}

var r9indi_circumscribe = function (node, config, ptimer, isCreation) {
    var dur = config.dur, stime = config.stime, color = config.color, sw = config.sw,
        time_width = config.time_width, pathStr = node.toPathString(),
        pathdata = node.toPathData(), cxt = ptimer.layer.getContext();
    var path = new Kinetic.Path({
        x: 0,
        y: 0,
        data: pathStr,
        strokeWidth: sw || 1,
        stroke: color,
        fillOpacity: 0
    });
    path.forceClose = false;
    path.strokeOnly = true;
    path.duration(dur);

    ptimer.addAni(node, function (progress, duration, times) {
        if (path.parent == null) {
            ptimer.layer.add(path);
        }
        //  cxt.setAttr('lineWidth', sw || 1);
        //  cxt.setAttr('strokeStyle', color); 
        //  Kinetic.Util.drawPathByProgress(path, cxt, pathdata, progress,  false, true);
        path.progressvalue(progress);
    }, stime, dur, true, 0, false, function () {
        if (isCreation) {
            tween_r9figure(node, {
                opa: 1.0, dur: 0.5, onFinish: function () {
                    path.remove();
                }
            }).play();
        } else {
            path.remove();
        }
    });
}

var r9indi_focuson = function (node, config, ptimer) {
    var dur = config.dur, stime = config.stime, center = node.getCenter();
    ptimer.addOneTimeEvt(node, function () {
        var circle = new Kinetic.Circle({
            radius: (node.width() + node.height()) / 4,
            fill: 'gray',
            fillOpacity: 0.2
        });
        circle.setCenter(center);
        ptimer.layer.add(circle);
        new Kinetic.Tween({
            node: circle, width: 2, height: 2, onFinish: function () {
                circle.remove();
            }, duration: dur
        }).play();
    }, stime, dur, true);
}

var r9indi_flash = function (node, config, ptimer) {
    var dur = config.dur, stime = config.stime, fo = node.fillAlpha(), fr = config.fr,
        fb = config.fb, fg = config.fg, fr1 = config.fr1,
        fb1 = config.fb1, fg1 = config.fg1, fr2 = config.fr2,
        fb2 = config.fb2, fg2 = config.fg2, times = config.times || 1, tgap = dur / times;
    var acct = 0;
    for (var i = 0; i < times; i++) {
        ptimer.addOneTimeEvt(node, function () {
            var tgap2 = tgap / 3.0;
            new Kinetic.Tween({
                node: node, fillRed: fr1, fillGreen: fg1, fillBlue: fb1, onFinish: function () {
                    new Kinetic.Tween({
                        node: node, fillRed: fr2, fillGreen: fg2, fillBlue: fb2, onFinish: function () {
                            new Kinetic.Tween({
                                node: node, fillAlpha: fo, fillRed: fr, fillGreen: fg, fillBlue: fb, onFinish: function () {
                                }, duration: tgap2
                            }).play();
                        }, duration: tgap2
                    }).play();
                }, duration: tgap2
            }).play();
        }, stime + acct, dur, true);
        acct += tgap;
    }
}

var r9indi_indicate = function (node, config, ptimer) {
    r9indi_focuson(node, config, ptimer);
}
var r9indi_showpassingflash = function (node, config, ptimer) {
    var dur = config.dur, stime = config.stime, color = config.color,
        bound = node.renderBounds();
    var line = new Kinetic.R9LineTip({
        fill: color,
        stroke: color,
        strokeWidth: 2,
        startX: bound.x,
        startY: bound.y + bound.h,
        endX: bound.x + bound.w,
        endY: bound.y + bound.h
    });
    ptimer.addAni(node, function (progress, duration, times) {
        if (line.parent == null) {
            ptimer.layer.add(line);
            line.duration(dur);
        }
        line.progressvalue(progress);
    }, stime, dur, true, 0, false, function () { line.remove(); });
}
var r9indi_wiggle = function (node, config, ptimer) {
    r9indi_circumscribe(node, config, ptimer);
}
var r9indi_applywave = function (node, config, ptimer) {
    r9indi_circumscribe(node, config, ptimer);
}



;
//r9 remote request handler, used to deal with waiting/resume
function R9RequestRegister() {
    this.rqcounts = 0;
    this.timer = null;
}
R9RequestRegister.prototype.markTimer = function (maxWaitTime) {
    if (this.timer)
        clearInterval(this.timer);
    if (this.rqcounts <= 0) return;
    var that = this;
    this.timer = setInterval(function () {
        maxWaitTime -= 100;
        if (maxWaitTime > 0) {
            r9.markr9times();
        } else {
            that.rqcounts--;
            clearInterval(that.timer);
            that.timer = null;
            that.markTimer(5000);
        }
    }, 100);
}
R9RequestRegister.prototype.addRqst = function () {
    if (this.rqcounts < 0) this.rqcounts = 0;
    this.rqcounts++;
    this.markTimer(10000);
}
R9RequestRegister.prototype.removeRqst = function () {
    this.rqcounts--;
    if (this.rqcounts <= 0) {
        if (this.timer)
            clearInterval(this.timer);
        this.timer = null;
        return;
    }
    this.markTimer(10000);
}
R9RequestRegister.prototype.empty = function () {
    return this.rqcounts <= 0;
}
R9RequestRegister.prototype.reset = function () {
    this.rqcounts == 0;
    if (this.timer)
        clearInterval(this.timer);
}





function R9AniWrap(node, setup, func, id, stimeInSec, durationInSec, wait, freq,
    resumeAni, callback, repeat, block) {
    this.node = node;
    this.realStime = 0;
    this.lastRunTime = 0;
    this.id = typeof id === 'undefined' ? "" : id;
    this.func = func;
    this.setup = setup;
    this.stime = stimeInSec * 1000 || 0;
    this.duration = durationInSec ? durationInSec * 1000 : -1;
    this.wait = wait || false;
    this.freq = freq ? freq * 1000 : 0;
    this.resumeAni = resumeAni || false;
    this.callback = callback;

    this.repeat = typeof repeat === 'undefined' ? false : repeat;
    this.block = typeof block === 'undefined' ? false : block;
    this.doneJob = false;
    this.invoked = false;
    this.doneChecker = null;
}
R9AniWrap.prototype.run = function (frame) {
    var ct = new Date().getTime();
    if (this.realStime == 0) {
        this.realStime = ct;
    } else {
        if (this.freq != 0 && ct - this.lastRunTime < this.freq)
            return;
    }
    if (this.lastRunTime == 0 && this.setup) {
        this.setup();
    }
    this.lastRunTime = ct;
    var accTime = ct - this.realStime;
    if( this.node && !this.node.parent ){
    	this.doneJob = true;
    	return;
    }
    if (this.duration > 0) {
        var progress = accTime / this.duration;
        if (progress < 1) {
            try { if( this.func ) this.func(progress, this.duration / 1000.0, accTime / 1000.0);  
                  else if( this.node ) this.node.progressvalue(progress); } catch (e) { r9_log_console(e); } 
            return true;
        } else {
            if (this.repeat) {
                this.reset();
            } else {
            	   try { if( this.func ) this.func(1, this.duration / 1000.0, accTime / 1000.0);  
                   else if( this.node ) this.node.progressvalue(1); } catch (e) { r9_log_console(e); } 
                this.doneJob = true;
            }
            return false;
        }
    } else { //duration <= 0, we treat as no-end
    	   try { if( this.func ) this.func(-1, this.duration / 1000.0, accTime / 1000.0);  
           else if( this.node ) this.node.progressvalue(-1); } catch (e) { r9_log_console(e); } 
        return true;
    }
}
R9AniWrap.prototype.isDone = function () {
	if( this.doneChecker != null && this.doneChecker() )
		return true;
    return this.doneJob;
}

R9AniWrap.prototype.reset = function () {
    this.lastRunTime = 0;
    this.realStime = 0;
    this.doneJob = false;
}

 

function R9InPageTimer(page, layerSetting, prefix, pos) {
    this.page = page;
    this.layerSetting = layerSetting;
    this.layer = layerSetting.layer;
    this.prefix = prefix;
    this.pos = pos;
    this.anim = null; 
    this.aniList = [];
    this.onetimeList = [];
    this.daemonList = [];
    this.registeredList = []; 
  
    this.doneAnim = false;
    this.doneTime = 0;
    this.paused = false;

    this.mediaReceived = 0;

    this.timer = 0;

    this.startTime = 0;
    this.accPausedTime = 0;
    this.lastPausedTime = 0;
}
R9InPageTimer.prototype.getPinByName = function(pinName){
	var  pinlist = this.layerSetting.pinList;
	if(! pinlist[pinName] ) 
		pinlist[pinName] = new Kinetic.SocketPin(pinName);
	return pinlist[pinName];
};
R9InPageTimer.prototype.registerPin = function(pinName, socket){
	var pin = this.getPinByName(pinName);
	pin.sockets.push(socket);
	socket.pin = pin;
	return pin;
};
R9InPageTimer.prototype.syncNodesByPins = function(){
	var visited = [], pinlist = this.layerSetting.pinList;
	for(var i in pinlist){
		var pin = pinlist[i];
		pin.syncWithUIChange(visited);
	}
};
R9InPageTimer.prototype.removePin = function(pinName){
	delete this.layerSetting.pinList[pinName];
};
R9InPageTimer.prototype.validatePins = function( ){
	var pinlist = this.layerSetting.pinList;
	for(var i in pinlist){
		var pin = pinlist[i];
		if( !pin.valid() )
		   delete pinlist[i];
	}
};

R9InPageTimer.prototype.markrun = function () {
    if (this.onetimeList.length > 0) {
        r9.markr9times(); return;
    }
    for (var i in this.aniList) {
        if (!this.aniList[i].repeat && !this.aniList[i].block && this.aniList[i].duration > 0) {
            r9.markr9times(); return;
        }
    }
}

R9InPageTimer.prototype.register = function (func, id, stimeInSec, durationInSec, wait, freqInSec,
    resumeAni, callback, repeat) {
    var func2 = func.bind(this.page);
    this.registeredList.push(new R9AniWrap(null, func2, id, stimeInSec, durationInSec,
        false, freqInSec, resumeAni, callback, repeat));
}

R9InPageTimer.prototype.wakeup = function (id, delayInMini) {
    for (var i in this.aniList) {
        if (aniList[i].id === id) {
            aniList[i].block = false;
            if (typeof delayInMini != 'undefined') {
                var timeused = new Date().getTime() - this.startTime - this.accPausedTime;
                aniList[i].stime = timeused + delayInMini;
            }
            break;
        }
    }
}
R9InPageTimer.prototype.activate = function (id, delayInMini) {
    for (var i in this.aniList) {
        if (aniList[i].id === id) {
            return;
        }
    }
    var found = null;
    for (var i in this.registeredList) {
        if (registeredList[i].id === id) {
            found = registeredList[i];
            if (typeof delayInMini != 'undefined') {
                var timeused = new Date().getTime() - this.startTime - this.accPausedTime;
                found.stime = timeused + delayInMini;
            }
            break;
        }
    }
    if (found) {
        this.aniList.push(found);
    }
}
R9InPageTimer.prototype.addAnimation = function (  func, stimeInSec, durationInSec ) {
    this.addAni2(null, null, func, stimeInSec, durationInSec, false, 0,
	        false, null, false, false, undefined);
}
R9InPageTimer.prototype.addAni = function (node, func, stimeInSec, durationInSec, wait, freqInSec,
    resumeAni, callback, repeat, block, id) {
    this.addAni2(node, null, func, stimeInSec, durationInSec, wait, freqInSec,
        resumeAni, callback, repeat, block, id);
}
R9InPageTimer.prototype.addAni2 = function (node, setup, func, stimeInSec, durationInSec, wait, freqInSec,
    resumeAni, callback, repeat, block, id) {
    var func2 = func == null ? null : func.bind(this.page);
    var setup2 = setup == null ? null : setup.bind(this.page);
    this.aniList.push(new R9AniWrap(node, setup2, func2, id, stimeInSec, durationInSec,
        wait, freqInSec, resumeAni, callback, repeat, block));
}
R9InPageTimer.prototype.addAniOnNodeProgress = function (obj, stimeInSec, durationInSec, wait, freqInSec,
    resumeAni, callback, repeat, block, id) {
    this.addAniOnNodeProgress2(obj, null, stimeInSec, durationInSec, wait, freqInSec,
        resumeAni, callback, repeat, block, id);
}
R9InPageTimer.prototype.addAniOnNodeProgress2 = function (obj, setup, stimeInSec, durationInSec, wait, freqInSec,
    resumeAni, callback, repeat, block, id) {
    //var setup2 = setup == null ? null : setup.bind(this.page);
    var func = function (progress, times) { try { obj.progress(progress, durationInSec, times / 1000.0); } catch (e) { r9_log_console(e); } return true; };
    this.addAni2(obj, setup, func, stimeInSec, durationInSec, wait, freqInSec, resumeAni, callback, repeat, block, id);
}

R9InPageTimer.prototype.addOneTimeEvt = function (node, func, stimeInSec, durationInSec, wait) {
    var func2 = func.bind(this.page);
    this.onetimeList.push({
        node: node, func: func2, stime: stimeInSec * 1000, dur: durationInSec * 1000, invoked: false,
        wait: wait
    });
}
//if checker return false, it means it should be removed from animation
//if func is null, invoke progressvalue on node.
R9InPageTimer.prototype.addDaeomEvt = function (inpage, id, node, func, durationInSec, checker) {
	if(!inpage && id && this.layerSetting.daemonList.filter(function(m){ return m.id == id; } ).length > 0 )
		return;
	if(inpage && id && this.daemonList.filter(function(m){ return m.id == id; } ).length > 0 )
		return;
	var func2 = func ; if( !func2 ) func2 = function(progress){ node.progressvalue(progress); };
	var repeat = true, stime = 0, wait = false, freq = 0, resume = false, callback = null;
	var w = new R9AniWrap(node, null, func2, id,stime, durationInSec || 1, wait, freq, resume, callback, repeat);
	w.doneChecker = checker;
	if( inpage ) this.daemonList.push(w); 
	else  this.layerSetting.daemonList.push(w); 
}
 

R9InPageTimer.prototype.addDelayOneTimeEvt = function (func, delayInSec) {
	if( this.startTime == 0 ) {
		this.addOneTimeEvt(null, func, 0, 0.1, true);
	}
	else {
		 var timeused = new Date().getTime() - this.startTime - this.accPausedTime;
	     this.addOneTimeEvt(null, func, timeused/1000 + delayInSec, 0.1, true);
	} 
}


R9InPageTimer.prototype.run = function (frame) {
    var that = this, notask = this.aniList.length == 0 && this.onetimeList.length == 0;
    var timeused = new Date().getTime() - this.startTime - this.accPausedTime;

    if (!this.doneAnim && notask  && r9.r9rqstRter.empty()) {
        this.doneTime++;
        if (this.doneTime > 10) {
            this.doneAnim = true;
            this.addOneTimeEvt(null, function () {
                var player = that.page.r9player;
                player.inSetup = false;
                if( that.page.pagestay ) that.page.pagestay();
                if (that.page.blockanimation) player.stop();
                else player.leavingPage();
            }, timeused / 1000.0 + that.page.staytimeInSec, 0.100, true);
            return;
        }
    }

    var needToPaint = false;
    for (var i = this.layerSetting.daemonList.length - 1; i >= 0; i--) {
        var target = this.layerSetting.daemonList[i];  
        if(  target.isDone() ){
           this.layerSetting.daemonList.splice(i, 1);
        } else {
        	var p = false;
           try {  p = target.run(frame); } catch (e) { r9_log_console(e);  }
           if (typeof p === 'boolean') {
               needToPaint = needToPaint || p;
           }
        } 
    }
    for (var i = this.daemonList.length - 1; i >= 0; i--) {
        var target = this.daemonList[i];  
        if(  target.isDone() ){
           this.daemonList.splice(i, 1);
        } else {
        	var p = false;
           try {  p = target.run(frame); } catch (e) { r9_log_console(e);  }
           if (typeof p === 'boolean') {
               needToPaint = needToPaint || p;
           }
        } 
    }
    if (this.paused){
    	if( needToPaint ){
    		this.syncNodesByPins();
    	    this.layerSetting.layer.batchDraw();
    	}
    	return;
    }


    var waitBg = (this.page.fromServerMedia) && !this.page.mdstarted;
    if (waitBg) {
        this.mediaReceived = timeused;
    }
 
    for (var i = this.aniList.length - 1; i >= 0; i--) {
        var target = this.aniList[i];
        if (target.block || (target.wait && waitBg))
            continue;
        if (target.node && !target.invoked && target.node.checkInAnimation())
            continue;
        var t = target.wait ? timeused - this.mediaReceived : timeused;
        if (t < target.stime) continue;
        var p = false;
        try { p = target.run(frame); } catch (e) { r9_log_console(e);  }
        target.invoked = true;
        if ( target.node ) target.node.setDuringAnimation(true);
        if ( target.isDone() ) {
            if (target.resumeAni) {
                r9.PageBus.publish(  "r9.core.animation.resume", { 'prefix': this.prefix,  'messageid': -1, 'pos': this.pos });
            }
            if (target.callback) target.callback();
            this.aniList.splice(i, 1);
            if (target.node ) target.node.setDuringAnimation(false);
        }
        if (typeof p === 'boolean') {
            needToPaint = needToPaint || p;
        }
    }
    for (var i = this.onetimeList.length - 1; i >= 0; i--) {
        var target = this.onetimeList[i];
        if (waitBg && target.wait) continue;
        if (target.node && !target.invoked && target.node.checkInAnimation()) continue;
        var t = target.wait ? timeused - this.mediaReceived : timeused;
        if (t < target.stime) continue;
        try {
            if (!target.invoked) {
                target.invoked = true;
                target.func();
                needToPaint = true;
            }
        } catch (e) {
            r9_log_console(e);
        }
        if (t >= target.stime + target.dur){ 
            this.onetimeList.splice(i, 1);
            if (target.node ) target.node.setDuringAnimation(false);
        }
    }

    this.markrun();
    this.syncNodesByPins();
    if (needToPaint) {
        this.layerSetting.layer.batchDraw();
    }
}

R9InPageTimer.prototype.schedule = function () {
    this.stop();
    var func = this.run.bind(this);
    var that = this;
    if (this.startTime == 0) {
        this.startTime = new Date().getTime();
    } else {
        this.accPausedTime += new Date().getTime() - this.lastPausedTime;
    }
    // this.timer =  setInterval(func, 50);
    that.anim = new Kinetic.Animation(function (frame) {
        func(frame);
    }, that.layer);
    that.anim.start();

}

R9InPageTimer.prototype.stop = function () {
    if (this.anim) { this.anim.stop(); }
    //if( this.timer ) {  clearInterval(this.timer) ; this.timer = 0; }; 
    this.lastPausedTime = new Date().getTime();
}

R9InPageTimer.prototype.destroy = function () {
    this.stop();
    this.onetimeList = [];
    this.aniList = [];
    this.registeredList = []; 
    this.daemonList = [];
    this.doneAnim = false;
    this.doneTime = 0;
    this.paused = false;
    this.mediaReceived = 0;
    this.startTime = 0;
    this.accPausedTime = 0;
    this.lastPausedTime = 0;
}
;

var R9PageChainPlayer = function (prefix,   layer) {
    var Player = this;
    this.prefix = prefix || ''; 
    this.chain = new Array();
    this.currentStep = 0;
    this.isRunning = false;
    this.inForceResume = false;
    this.inSetup = false;
    this.r9pplan = [];
    this.state = '';
  //  this.timer = new R9InLayerTimer(layer, this, prefix);
  //  this.timer.schedule();

    this.checkAnimationPlan = function () {
        if (!Player.r9pplan || Player.r9pplan.length == 0) return false;
        try {
        	var aplan = Player.r9pplan[0];
            if (aplan.end >= 0 && aplan.end <= Player.currentStep) {
                /** if it is part of jump animation.... */
                var jumploc = r9parseBookmark(aplan.jumpFrom, true);
                var jumpTimeline = r9parseBookmark(aplan.jumpFrom, false);
                var page = Player.getCurPage();
                if (jumploc > 0 || Player.r9pplan.length > 1) {
                	    if (typeof page.pageend === "function") { page.pageend(); }
	                    if (typeof page.pagecleanup == 'function') try { page.pagecleanup(); } catch (e) { r9_log_console(e); } 
	               if (jumploc > 0) { //not in mistake review 
	                    r9.PageBus.publish('r9.core.animation.hotphase', { 'hotphase_pos': jumploc, 'timeline_name': jumpTimeline, 'pplan': [], 'destory_it': true });
	                    return true;
	                } else  { 
	                    Player.r9pplan.splice(0, 1);
	                    if( jumpTimeline == Player.prefix ){
	                    	Player.initialStartFrom(Player.r9pplan[0].start);
	                    } else {
	                    	  r9.PageBus.publish('r9.core.animation.hotphase', { 'hotphase_pos': 0, 'pplan': Player.r9pplan, 'destory_it': true });
	                    } 
	                    return true;
	                }
                }
            }
        } catch (e) {
            r9_log_console(e);
        }
        return false;
    };


    this.isMainTimeline = function () {
        return prefix == null || prefix.length == 0;
    };
    this.cleanupCurrentPage = function () {
        try { r9.removeOverlapLayer(prefix); } catch (e) { r9_log_console(e); } 
        var clayer = r9.lys(prefix), tnodes = clayer.tmpnodes;
        if (clayer.ptimer) { clayer.ptimer.destroy(); }
        if (tnodes.length > 0) {
            for (var i in tnodes) {
                var node = clayer.i2f[tnodes[i].oid];
                if (node) {
                    r9twnrm(node, 1, tnodes[i].exittype || 0);
                }
            }
            clayer.tmpnodes = []; clayer.gnrtrids = {};
        } 
        if (typeof window._dismissr9keyboard === "function") {
            _dismissr9keyboard();
        }
        r9.r9rqstRter.reset();
    };



    this.getCurPage = function () {
        return this.chain[this.currentStep].page;
    }
    this.reset = function () {
        Player.stop();
        Player.currentStep = 0;
        Player.start();
    };
    this.start = function () {
        if (Player.chain.length == 0) return;
        if (Player.isRunning == true) return;
        Player.isRunning = true;
        Player.startCurrentPage();
    };
    this.nextStep = function () {
        this.state = 'next';
        if (!this.isRunning) return;
        this.cleanupCurrentPage();
        if (this.checkAnimationPlan()) return;
        Player.currentStep = Player.currentStep + 1;
        if (Player.currentStep == Player.chain.length) {
            Player.currentStep = Player.chain.length - 1;
            r9.PageBus.publish("r9.core.animation.finish", { 'targetId': 'curFrameIndex_' + Player.currentStep, 'prefix': prefix });
            Player.stop();
            // if( Player.bgvideo ){             Player.chain[Player.currentStep-1].page.endbgvideo(); }
        } else {
            Player.startCurrentPage();
            r9.PageBus.publish(prefix + "r9.core.event.studyEvent", { 'targetId': 'curFrameIndex_' + Player.currentStep, 'eventType': 'OnNewFrame' });
        }
        if (Player.currentStep + 1 >= Player.chain.length) {
            r9.PageBus.publish(prefix + "r9.core.event.studyEvent", { 'targetId': 'curFrameIndex_' + Player.currentStep, 'eventType': 'FinishedLastFrame', 'prefix': Player.prefix });
        }
    };
    this.resume = function (pos) {
        if (Player.chain.length == 0) return;
        if (Player.isRunning == true) return;
        Player.isRunning = true;
        var page = this.getCurPage();
        if (this.inSetup) {
            page.ptimer.paused = false;
            return;
        };
      //  if (this.state === 'transended') this.startCurrentPage();
        if (this.state === 'start') this.leavingPage();
        if (this.state === 'leaving') this.nextStep();
        if (this.state === 'next') this.nextStep();
        this.state = '';
    };

    this.startCurrentPage = function () {
        this.state = 'start';
        if (!this.isRunning) return;
        this.inSetup = false;
        var page = Player.chain[Player.currentStep].page;
        var clayer = r9.lys(prefix);

        if (clayer.ptimer) {
        	clayer.ptimer.destroy();
        }
        clayer.ptimer = page.ptimer;
        page.ptimer.validatePins();
        //inside pageenter, setupPage must be called
        if (typeof page.pageenter == 'function') try { page.pageenter(this); } catch (e) { r9_log_console(e);  this.setupPage() ; }
        else this.setupPage();
    };
    this.setupPage = function () {
      //  this.state = 'transended';
        if (!this.isRunning) return;
        var page = this.getCurPage();

        try { page.pagesetup(this); page.ptimer.schedule(); } catch (e) { r9_log_console(e); }
    };
    this.leavingPage = function () {
        this.state = "leaving";
        if (!this.isRunning) return;
        var page = this.getCurPage();
        if (typeof page.pageend == 'function') try { page.pageend(); } catch (e) { r9_log_console(e); }
        if (typeof page.pagecleanup == 'function') try { page.pagecleanup(); } catch (e) { r9_log_console(e); }
        if (typeof page.stageexit == 'function') {   //stageexit should call nextStep()
        	try { page.stageexit(this); } catch (e) { r9_log_console(e); this.nextStep(); }
        } else{ 
        	this.nextStep();
        } 
    };

    this.stop = function () {
        Player.isRunning = false;
        if (this.inSetup) {
            var page = this.getCurPage();
            page.ptimer.paused = true;
        };
    };
    this.add = function (_page, _staytime, _transtime) {
        _page.r9player = this;
        _page.staytimeInSec = _staytime;
        Player.chain[Player.chain.length] = { page: _page, transtimeInSec: _transtime, staytimeInSec: _staytime };
    };

    this.distroy = function () {
        this.stop();
        Player.chain = [];
      //  this.timer.destroy();
    };
    this.restartFrom = function (_page, phasePosition) {
     //   this.stop();
        _page.r9player = this; 
        if( Player.chain[phasePosition] ){
        	 _page.staytimeInSec = Player.chain[phasePosition].staytimeInSec;
             Player.chain[phasePosition] = { page: _page, transtimeInSec: Player.chain[phasePosition].transtimeInSec, staytimeInSec: Player.chain[phasePosition].staytimeInSec };
        } else {
        	 _page.staytimeInSec = 1;
        	   Player.chain[phasePosition] = { page: _page, transtimeInSec: 1, staytimeInSec: 1 };
        } 
        this.initialStartFrom(phasePosition);
    };
    this.initialStartFrom = function (phasePosition) {
        this.stop();
        Player.state = '';
        Player.isRunning = true;
        Player.currentStep = phasePosition;
        Player.startCurrentPage();
    };

    this.setupPlan = function (rplan) {
        this.r9pplan = rplan;
    };

};var LayerSetting = function(name, layer, resumeAnimation, autoClose){
	 this.name = name;
	 this.i2f = {};
	 this.emotions = {};
	 this.transpages = [];
     this.r9player = null;
     this.tmpnodes = [];
     this.gnrtrids = {};
     this.ptimer = null;
     this.layer = layer;
     this.ra = resumeAnimation;
     this.autoClose = autoClose;
     this.daemonList = [];	
     this.pinList = {};
     this.size = null;
}
LayerSetting.prototype.destroy = function(){
	var p = this.r9player;
	if( p != null ) p.stop(); 
	if( p != null && (typeof p.getCurPage().pagecleanup == 'function')) p.getCurPage().pagecleanup();
	if( this.layer != null ) this.layer.destroy(); 
	this.emotions = {}; 
	this.transpages = [];  
	 this.tmpnodes = [];
     this.gnrtrids = {};
	this.daemonList = [];	
    this.pinList = {};
    if( typeof r9 != 'undefined') r9.PageBus.cleanupTimeline(this.name);
    this.layer = null;  
}


var R9StudioStage = function (r9topdivid, docuuid, stageProps) {
    this.r9topdivid = r9topdivid;
    this.docuuid = docuuid;
    this.vjsid = "vjs_" + r9topdivid;
    this.cvsid = "cvs_" + r9topdivid;
    this.topdom = document.getElementById(r9topdivid);
    this.vjsdom = document.getElementById(this.vjsid);
    this.cvsdom = document.getElementById(this.cvsid);

    this.firstload = true;
    this.initialTTS = false;
    this.PageBus = PageBus;
    this.r9timestamp = 0;
    this.width = stageProps.docwidth;
    this.height = stageProps.docheight;
    this.stage = new Kinetic.Stage({ container: this.cvsid, width: stageProps.docwidth, height: stageProps.docheight });


    if (stageProps.hasBgJsAnimation) {
//        this.bbcachelayer = new Kinetic.Layer();
//        this.stage.add(this.bbcachelayer);
        this.bblayer = new Kinetic.Layer();
        this.stage.add(this.bblayer);
    }
    var mlayer = new Kinetic.Layer();
    this.layersetting = new LayerSetting('', mlayer, false, false); 

    this.stage.add(mlayer);

    this.bgAniJsHandler = null;
    this.r9pathdict = [];
    this.baiduacctoken = null; this.appuuid = Math.random();
    this.baiduerror = false;
    this.ttsspeed = stageProps.ttsspeed;
    this.baiduTTS = stageProps.baiduTTS;
    this.FOR_IPAD_AS4 = stageProps.FOR_IPAD_AS4;
    this.r9userprofile = { 'name': r9getURLPara('r9username'), 'tname': stageProps.usernameHolder };
    this.r9gsummary = { 'score': 0, 'total': 0, 'emotion': '', 'pos': 0, 'totalpos': stageProps.totalpos };
    this.hotspotCanJumpAfterVisitOnly = stageProps.hotspotCanJumpAfterVisitOnly;
    this.layerstack = [];
    this.timelinescreens = []; 

    this.curtarget = null;
    this.docw = 100; this.doch = 100;
    this.hotphases = {}; this.htpsovals = {}; this.htpsflag = {};

    this.animationFrameId = 0; this.flagset = []; this.score_report = [];
    this.firstload = true; this.acheivedwards = []; this.awardimages = [];
    this.varsTable = {};
    this.varsTypeTable = {};
    //zero is correct,  undefined is unused in problemscores
    this.problemscores = {}; this.problemlocs = {}; this.mcpoptions = {};

    this.inSpeakerMode = true;
    this.usetts = true;
    this.initialTTS = false;
    this._langCode_ = 'zh';

    this.newimages = stageProps.newimages || [];
    // this.loadedimages=0;  

    this.r9rqstRter = new R9RequestRegister(this);

    this.r9captiontimer = -1;
    this.capline = new Kinetic.Rect(r9figure({ fg: 255, sw: 1.0, w: this.stage.getWidth(), h: 36, x: 0, y: this.stage.getHeight() - 75, fr: 255, fsz: 24.0, dr: false, sb: 255, fal: 0.05, sed: false, sg: 255, fb: 255, value: '', sr: 255, opa: 1 }));
    this.captext = new Kinetic.R9Text(r9figure({ sft: 0, dur: 0, fg: 1, sw: 1.0, h: 27, fr: 1, fsz: 22.0, fs: 'normal', dr: false, sb: 1, sg: 1, lh: 26, fb: 1, ran: 0, sr: 1, opa: 1, x: 0, y: this.stage.getHeight() - 80 }));

    // this.tmpnodes = [];

    this.bgvideotimeline = null;
    this.bgvideojs = null;
    this.autoCreatedVideo = false;
    
    this.draftbutton = null;
    this.playbutton = null;
    this.restartbutton = null;
    this.bgvideoplaybutton = null;
    this.obj2loc = {};
    this.variables = [];
    this.varmtime = 0;
    this.PageBus.subscribe('r9.core.study.score.report', this, this.onScoreReport, '#');
    this.PageBus.subscribe('r9.core.event.captionLineEvent', this, this.onR9CaptionLine, null, '#');
}

R9StudioStage.prototype.onR9CaptionLine = function (subject, edo, ssd) {
    var that = this;
    if (subject == 'r9.core.event.captionLineEvent') {
        clearTimeout(that.r9captiontimer);
        that.capline.remove();
        if (edo.caption != null && edo.caption.length > 0) {
            that.capline.y(that.stage.getHeight() - 75);
            that.layer().add(that.capline);
        }
        that.layer().draw();
    }
    that.captext.remove();
    if (edo.caption != null && edo.caption.length > 0) {
        that.captext.y(that.stage.getHeight() - 80);
        that.layer().add(that.captext);
        that.captext.setFontSize(22);
        that.captext.text(edo.caption);
        that.captext.otext(edo.caption);
        that.captext.r9textstyle(edo.r9textstyle);
        that.captext._setTextData();
        var lx = (that.stage.getWidth() - that.captext.getWidth()) / 2;
        if (lx < 0) {
            that.captext.setFontSize(20);
            lx = (that.stage.getWidth() - that.captext.getWidth()) / 2;
        };
        that.captext.x(lx);
    }
    that.layer().draw();
    that.r9captiontimer = setTimeout(function () { that.capline.remove(); that.captext.remove(); }, edo.duration);
}

R9StudioStage.prototype.setVarValue = function (varid, value) {
    var vtype = this.varsTypeTable[varid];
    if (vtype.t === 0) this.varsTable[varid] = value;
    if (vtype.t === 1) this.varsTable[varid] = parseInt(value);
    if (vtype.t === 2) this.varsTable[varid] = parseFloat(parseFloat(value).toFixed(vtype.f));
    if (vtype.t === 3) this.varsTable[varid] = parseInt(value);
    this.varmtime = new Date().getTime();
}
R9StudioStage.prototype.getVarValue = function (varid) {
    var vtype = this.varsTypeTable[varid];
    if (vtype.t === 1) return parseInt(this.varsTable[varid] || 0);
    if (vtype.t === 2) return parseFloat(parseFloat(this.varsTable[varid] || 0).toFixed(vtype.f));
    if (vtype.t === 3) return parseInt(this.varsTable[varid] || 0);
    return this.varsTable[varid];
}

R9StudioStage.prototype.setVariTable = function (variables) {
    if (variables) this.variables = variables;
    this.varsTable = {};
    this.varsTypeTable = {};
    this.varsTable['R9_V_SCORE'] = 0;
    this.varsTypeTable['R9_V_SCORE'] = { t: 2, f: 2 };
    this.varsTable['R9_V_TIME'] = new Date().getTime();
    this.varsTypeTable['R9_V_TIME'] = { t: 3 };
    for (var i in this.variables) {
        this.varsTable[this.variables[i].id] = this.variables[i].value;
        this.varsTypeTable[this.variables[i].id] = this.variables[i].types;
    }
}


R9StudioStage.prototype.clearCurPageForMainline = function () {
    this.layer().removeChildren();
    if (this.playbutton) this.layer().add(this.playbutton);
    if (this.restartbutton) this.layer().add(this.restartbutton);
    var player = this.lys().r9player;
    if (typeof player.getCurPage().pagecleanup === 'function') {
        player.getCurPage().pagecleanup();
    }
    this.layer().draw();
}

R9StudioStage.prototype.queryCachedLoc = function (targetid, loc) {
    if (!this.obj2loc[targetid]) {
        this.obj2loc[targetid] = loc
        return null;
    }
    var dif = { x: loc.x - this.obj2loc[targetid].x, y: loc.y - this.obj2loc[targetid].y };
    this.obj2loc[targetid] = loc
    return dif;
}

R9StudioStage.prototype.addNodeToLayer = function (node) {
	this.layer().add(node);
	this.lys().tmpnodes.push({id : node.id})
}

R9StudioStage.prototype.reload = function () {
    this.bgAniJsHandler = null;
    this.r9gsummary.score = 0; this.r9gsummary.total = 0; this.r9gsummary.pos = 0;
    this.clearLayerStack(true);

    this.curtarget = null;

    this.animationFrameId = 0; this.flagset = []; this.score_report = [];
    this.acheivedwards = [];
    this.setVariTable(null);

    this.problemscores = {}; this.mcpoptions = {};

}
R9StudioStage.prototype.changePscore = function (pid, score){
	if( typeof this.problemscores[pid] == 'undefined' ) this.problemscores[pid] = 0;
	this.problemscores[pid] += score;
}
R9StudioStage.prototype.pscoreCorrect = function (pid ){
	return this.problemscores[pid] == 0; 
}
R9StudioStage.prototype.pscoreWrong = function (pid ){
	return  !!this.problemscores[pid]; 
}
R9StudioStage.prototype.pscoreUnused = function (pid ){
	return  typeof this.problemscores[pid] == 'undefined'; 
}
R9StudioStage.prototype.getCacheImageByName = function (name) {
    for (var img in this.newimages) {
        if (this.newimages[img].name === name ||
            this.newimages[img].name === name) {
            return this.newimages[img];
        }
    }
    for (var img in this.newimages) {
        if (this.newimages[img].name + ".png" === name ||
            this.newimages[img].name + ".jpg" === name) {
            return this.newimages[img];
        }
    }
    for (var img in this.newimages) {
        if (this.newimages[img].src.indexOf("/" + name + ".png") >= 0 ||
            this.newimages[img].src.indexOf("/" + name + ".jpg") >= 0) {
            return this.newimages[img];
        }
    }
    for (var img in this.newimages) {
        if (this.newimages[img].src.indexOf(name + ".png") >= 0 ||
            this.newimages[img].src.indexOf(name + ".jpg") >= 0) {
            return this.newimages[img];
        }
    }
    for (var img in this.newimages) {
        if (this.newimages[img].src.indexOf(name) >= 0) {
            return this.newimages[img];
        }
    }
    return null;
};



R9StudioStage.prototype.update_score = function (result) {
    var found;
    for (var i = 0; i < this.score_report.length; i++) {
        if (this.score_report[i].conceptName == result.conceptName) {
            found = this.score_report[i]; break;
        }
    }

    if (found) {
        found.total = found.total + result.weight;
        found.score += result.score * result.weight;
        for (var i = 0; i < result.aspects.length; i++) {
            var fas = false;
            for (var j = 0; j < found.aspects.length; j++) {
                if (result.aspects[i].aspect == found.aspects[j].aspect) {
                    fas = true; found.aspects[j].total = found.aspects[j].total + result.aspects[i].value;
                    found.aspects[j].value += result.aspects[i].value * result.score; break;
                }
            }
            if (!fas) {
                found.aspects[found.aspects.length] = result.aspects[i];
                result.aspects[i].total = result.aspects[i].value;
                result.aspects[i].value = result.aspects[i].value * result.score;
            }
        }
    } else {
        this.score_report[this.score_report.length] = result;
        result.total = result.weight;
        for (var i = 0; i < result.aspects.length; i++) {
            result.aspects[i].total = result.aspects[i].value;
            result.aspects[i].value = result.aspects[i].value * result.score;
        }
    }

}

R9StudioStage.prototype.score_by_concept = function (conceptName) {
    for (var i = 0; i < this.score_report.length; i++) {
        if (this.score_report[i].conceptName == conceptName) {
            var found = this.score_report[i];
            var mapped = [];
            for (var i = 0; i < found.aspects.length; i++) {
                var asp = { 'aspect': found.aspects[i].aspect, 'value': Math.ceil(found.aspects[i].value * 100 / found.aspects[i].total) };
                mapped.push(asp);
            }
            return mapped;
        }
    }
    return null;
}

R9StudioStage.prototype.overallscore = function () {
    var total = 0, score = 0;
    for (var i = 0; i < this.score_report.length; i++) {
        var found = this.score_report[i];
        for (var i = 0; i < found.aspects.length; i++) {
            score += found.aspects[i].value; total += found.aspects[i].total;
        }
    }
    var percentage = total == 0 ? 0 : Math.ceil(score * 100 / total); return { 'percentage': percentage, 'score': score, 'total': total };
}

R9StudioStage.prototype.onScoreReport = function (subject, edo, sd) {
    if (subject == 'r9.core.study.score.report') {
        this.update_score(edo);
    }
};

R9StudioStage.prototype.ttssetup = function (page, pos, pageid, prefix, ttsStr, langCode, resumeAfterTTs, fromText, 
		topicId, subtopic, callback, role, ttsNoBlkAni) {
    var pauseAni = false; var ttsNoBlkAni2 = typeof ttsNoBlkAni == 'undefined' ? false : ttsNoBlkAni;
    if( typeof _langCode_ != 'undefined' && !langCode )  langCode = _langCode_;
    //if there is tts for text . we should speak here
    if (this.usetts && this.inSpeakerMode && ttsStr.trim().length > 0) {
        if (this.r9userprofile.name && this.r9userprofile.tname) {
            var reg = new RegExp(this.r9userprofile.tname, 'g'); ttsStr = ttsStr.replace(reg, this.r9userprofile.name);
        }

        //IMPORTANT : " _langCode_ = " is used in TranslateUI to replace locale.
        //PLEASE DONT CHANGE IT
        if( langCode )
        	this._langCode_ = langCode; pauseAni = resumeAfterTTs;
        if (this.FOR_IPAD_AS4) {
            ipad_as4_speak( page, pos, prefix, ttsStr, pauseAni, topicId, subtopic, callback, ttsNoBlkAni2);
        }
        else if (this.baiduTTS) {
            var speed = this.ttsspeed;
            if (navigator.onLine && !this.baiduerror) {
                try { onBaiduTTS( page, pos, prefix, ttsStr, this._langCode_, pauseAni, speed, topicId, subtopic, callback, role, ttsNoBlkAni2); } catch (err) { }
            } else {
                startSpeakInPage(  page);
                speakText(pos, page , prefix, ttsStr, this._langCode_, pauseAni, isipad ? 1.1 : 0, topicId, subtopic, callback, ttsNoBlkAni2);
            }
        } else {
            startSpeakInPage( page);
            speakText(pos, page , prefix, ttsStr, this._langCode_, pauseAni, isipad ? 1.1 : 0, topicId,subtopic, callback, ttsNoBlkAni2);
        }

        if (pauseAni) { this.PageBus.publish('r9.core.animation.stop', { 'messageid': -1, 'prefix': this.prefix }); }

    }
    return pauseAni;
}

R9StudioStage.prototype.markr9times = function () {
    this.r9timestamp = new Date().getTime();
}
R9StudioStage.prototype.getTopLayerSetting = function () {
    return this.layerstack.length == 0 ? this.layersetting : this.layerstack[this.layerstack.length - 1];
}
R9StudioStage.prototype.layer = function () {
    return this.layerstack.length == 0 ? this.layersetting.layer : this.getTopLayerSetting().layer;
}

R9StudioStage.prototype.redrawTopLayer = function () {
    this.layer().draw();
}

R9StudioStage.prototype.pushNewLayer = function (name, layer, resumeAnimation, autoClose) {
    this.layerstack.push( new LayerSetting(name, layer, resumeAnimation, autoClose) );
}

R9StudioStage.prototype.topLayerPos = function () {
    var l = this.layer(); return { x: l.x(), y: l.y() };
}
R9StudioStage.prototype.getCurPage = function () {
    return this.getTopLayerSetting().r9player.getCurPage();
}
R9StudioStage.prototype.getCurPlayer = function () {
    return this.getTopLayerSetting().r9player;
}
R9StudioStage.prototype.getPlayerByName = function (name) {
    return this.lys(name).r9player;
}


R9StudioStage.prototype.getLayerPos = function (name) {
    if (!name) return 0;
    for (var i = 0; i < this.layerstack.length; i++) {
        if (this.layerstack[i].name === name)
            return i;
    }
    return 0;
}
R9StudioStage.prototype.lys = function (name) {
    return name ? this.layerstack[this.getLayerPos(name)] : this.layersetting;
}

R9StudioStage.prototype.removeOverlapLayer = function (name) {
    var curLayerPos = 0;
    if (name) {
        curLayerPos = this.getLayerPos(name);
    }
    if (curLayerPos <= 0 || curLayerPos == this.layerstack.length - 1) return;
    while (curLayerPos < this.layerstack.length - 1) {
        var l = this.layerstack.pop(); if (l) { this.finishLayer(l); }
    }
}
R9StudioStage.prototype.clearLayerStack = function (all) {
    var btm = all ? 0 : 1;
    while (this.layerstack.length > btm) {
        var l = this.layerstack.pop(); if (l) { this.finishLayer(l); }
    }
}

R9StudioStage.prototype.finishLayerByName = function (name) {
    var layercomp = this.lys(name);
    this.finishLayer(layercomp);
}
R9StudioStage.prototype.finishLayer = function (layercomp) {
    var pos = this.layerstack.indexOf(layercomp);
    if (pos >= 0)
        this.layerstack.splice(pos, 1);  
    if( typeof layercomp.layerExitCode == 'function'){
        layercomp.layerExitCode(layercomp);
    }
    else {
    	layercomp.destroy();
    	if( layercomp.ra )
    		this.getCurPlayer().resume();
    		this.PageBus.publish( "r9.core.animation.resume", { 'prefix':prefix, 'messageid': -1, 'pos': -1 });
   }
}

R9StudioStage.prototype.getBackgroundNode = function () {
    var laysetting = this.getTopLayerSetting(), i2f = laysetting.i2f, size = laysetting.size;
    if (!i2f['_bgrect_']) {
        i2f['_bgrect_'] = new Kinetic.Rect({
            fillRed: 0, fillGreen: 0, fillAlpha: 1.0, fillBlue: 0, draggable: false, width: size ? size.width: this.width,
            height: size ? size.height : this.height, x: size? size.x : 0, y: size ? size.y : 0,
        });
        laysetting.layer.add(i2f['_bgrect_']);
        i2f['_bgrect_'].moveToBottom();
    }
    return i2f['_bgrect_'];
}

R9StudioStage.prototype.shiftBackgroundNode = function (x, y, duration) {
    var that = this, layer = that.getTopLayerSetting().layer,
        isfullscreen = (that.width == layer.width()) && (that.height = layer.height());
    if (isfullscreen) {
        var _bgrect_ = that.getBackgroundNode(), layer_x = layer.x(), layer_y = layer.y();
        var bx = _bgrect_.x(); by = _bgrect_.y();
        _bgrect_.x(- Math.abs(x)); _bgrect_.y(- Math.abs(y));
        var adj_x = x * layer_x < 0 ? Math.abs(x) + Math.abs(bx) : Math.max(Math.abs(x), Math.abs(bx));
        var adj_y = y * layer_y < 0 ? Math.abs(y) + Math.abs(by) : Math.max(Math.abs(y), Math.abs(by));
        _bgrect_.width(adj_x + layer.width());
        _bgrect_.height(adj_y + layer.height());
    }
    new Kinetic.Tween({ node: that.getTopLayerSetting().layer, x: x, y: y, duration: duration }).play();
}


R9StudioStage.prototype.showMessageNode = function (dnclayer, messageid, message, anode, duration, 
		resumeAnimation,  jumpTimeline, noTTS,  langCode, pos, pageid, prefix, topicId, subtopic ) {
    dnclayer.add(anode);
    anode.opacity(0);
    if (typeof pos === "undefined") { pos = -1; }
    if (!prefix) prefix = "";
    var page = this.getCurPage(); page.mdstarted = true;
    var _this = this;
    new Kinetic.Tween({
        node: anode,
        opacity: 1,  scaleX: 1, scaleY: 1,
        duration: 0.5,
        onFinish: function () {
        	if ( noTTS || message == '#' ) { //we used #as placeholder for math
        		  new Kinetic.Tween({
        		        node: anode,
        		        opacity: 1,   
        		        duration: duration,
        		        onFinish: function () {
        		        	 new Kinetic.Tween({
        	        		        node: anode,
        	        		        opacity: 0.2,   
        	        		        duration: 0.5,
        	        		        onFinish: function () {
        	        		            anode.remove();
           		                        if (resumeAnimation)
           		                            _this.PageBus.publish(  "r9.core.animation.resume", { 'prefix':prefix, 'messageid': -1, 'pos': pos });
           		                        if (jumpTimeline)  
           		                            _this.PageBus.publish( 'r9.core.animation.timeline', { 'prefix':prefix, 'timeline': jumpTimeline });
           		                     }
        	        		  }).play();
        		        }
        		  }).play(); 
        	} else {
        		_this.ttssetup(page, pos, pageid, prefix, _r9norm(message),
        		            langCode , resumeAnimation, true, topicId, subtopic, function () {
        		                var tween = new Kinetic.Tween({
        		                    node: anode,
        		                    opacity: 0.6,
        		                    easing: Kinetic.Easings['Linear'],
        		                    duration: 0.6,
        		                    onFinish: function () {
        		                        anode.remove();
        		                        if (resumeAnimation)
           		                            _this.PageBus.publish( "r9.core.animation.resume", { 'prefix':prefix, 'messageid': -1, 'pos': pos });
                                        if (jumpTimeline)  
        		                            _this.PageBus.publish( 'r9.core.animation.timeline', { 'prefix':prefix, 'timeline': jumpTimeline });
        		                     }
        		                });
        		                tween.play(); 
        		            }, '', true);
        	}
        }
    }).play(); 
    
   
    this.PageBus.publish('r9.core.event.studyEvent', { 'targetId': messageid, 'eventType': 'ShowMessage', 'prefix': this.prefix });
}
R9StudioStage.prototype.showMessageBorder = function (dnclayer, messageid, otext, textstyle, math, strokeColor, scr, scg, scb,
		bgr,bgg, bgb, fontSize, width, height, posX, xoff,  posY, yoff, duration, resumeAnimation, langCode,    
        pos, pageid, prefix, topicId, subtopicId, borderType, noTTS, jumpTimeline) {
    if (typeof borderType === 'undefined') borderType = 'Cloud';
    var anode = new Kinetic.R9Text(r9figure({
       width: width, height: height, r9textstyle: textstyle, otext: otext, text: otext, math: math,
        x: posX, y: posY, fontSize: fontSize || 18, borderColorStr: strokeColor, borderType:  borderType,
        strokeWidth: 1, corner: 4, shadowOffsetX: 0.5, shadowOffsetY: 0.5,
        textXOffset: xoff, scaleX: 0.1, scaleY: 0.1, textYOffset: yoff,
        fr: bgr, fg: bgg, fb: bgb, sr: scr, sg: scg, sb: scb,   fillOpacity:1,  useBackground:1,  borderWidth:1
    }));
    this.showMessageNode(dnclayer, messageid, otext, anode, duration, resumeAnimation, jumpTimeline, noTTS, langCode,   
        pos, pageid, prefix, topicId, subtopicId);

};
R9StudioStage.prototype.showMessageBorder2 = function (dnclayer, messageid,  otext, textstyle, math,  
		stageWidth, stageHeight, posX, posY, borderType, duration, resumeAnimation, langCode, rate,   fontSize,
    pos, pageid, prefix, topicId, subtopicId) {
	 if (typeof borderType === 'undefined') borderType = 'Cloud';
    var anode = new Kinetic.R9Text(r9figure({
    	  width: 100, height: 50,  r9textstyle: textstyle, otext: otext, text: otext, math: math,
          x: posX || 0, y: posY || 0, fontSize: fontSize || 18, borderColorStr: 'rgba(1, 1,1, 0.9)', borderType: borderType,
          strokeWidth: 1, corner: 4, shadowOffsetX: 0.5, shadowOffsetY: 0.5,
          textXOffset: 10, scaleX: 0.1, scaleY: 0.1, textYOffset: 5,
          fr: 255, fg: 255, fb: 255, sr: 1, sg: 1, sb: 1,   fillOpacity:1,  useBackground:1,  borderWidth:1
    }));
    anode.resetOffset(30,15);
    if( !posX )  anode.x((stageWidth - anode.width()) / 2);
    if( !posY )  anode.y((stageHeight - anode.height()) / 2);
    this.showMessageNode(dnclayer, messageid, otext, anode, duration, resumeAnimation, "", false ,  langCode,  
        pos, pageid, prefix, topicId, subtopicId);
};
R9StudioStage.prototype.showMessage = function (dnclayer, messageid, message, stagewidth, stageheight, duration, resumeAnimation, 
		langCode, rate, pos, pageid, prefix, topicId,subtopicId) {
    this.showMessageBorder2(dnclayer, messageid, message, null, null, stagewidth, stageheight, 0,0, 'Cloud',  duration, resumeAnimation,
    		langCode, rate, 20, pos, pageid, prefix, topicId, subtopicId);
};

//R9StudioStage.prototype.showColorMessage = function (dnclayer, messageid, message, stagewidth, stageheight, duration, resumeAnimation, langCode, rate, fontColor, bgColor,
//    pos, pageid, prefix, topicId) {
//    if (!prefix) prefix = ""; stagewidth = stagewidth || this.width; stageheight = stageheight || this.height;
//    this.PageBus.publish('r9.core.event.studyEvent', { 'targetId': messageid, 'eventType': 'ShowMessage', 'prefix': this.prefix });
//    var messagedialog = new Kinetic.Label({
//        x: stagewidth / 2,
//        y: stageheight / 2,
//        opacity: 1
//    });
//
//    messagedialog.add(new Kinetic.Tag({
//        fill: bgColor,
//        pointerDirection: 'down',
//        pointerWidth: 10,
//        pointerHeight: 10,
//        lineJoin: 'round',
//        shadowColor: 'white',
//        shadowBlur: 1,
//        shadowOffset: { x: 1, y: 1 },
//        shadowOpacity: 0.5
//    }));
//
//    messagedialog.add(new Kinetic.Text({
//        text: _r9norm(message),
//        fontFamily: 'Calibri',
//        fontSize: 22,
//        padding: 5,
//        fill: fontColor
//    }));
//
//
//    dnclayer.add(messagedialog);
//    dnclayer.draw();
//
//    if (typeof pos === "undefined") { pos = -1; }
//    var page = this.getcurpage(); page.mdstarted = true;
//    this.ttssetup(page, pos, pageid, prefix, _r9norm(message),
//        langCode, resumeAnimation, true, topicId, function () {
//            var tween = new Kinetic.Tween({
//                node: messagedialog,
//                opacity: 0.6,
//                easing: Kinetic.Easings['Linear'],
//                duration: duration,
//                onFinish: function () {
//                    messagedialog.remove();
//                }
//            });
//            tween.play();
//
//        }, '', true);
//};

R9StudioStage.prototype.showDialog = function (dnclayer, messageid, title, message1, message2, message3, follow, stagewidth, stageheight, duration, resumeAnimation, langCode, rate) {
    this.PageBus.publish('r9.core.animation.stop', { 'messageid': messageid, 'prefix': this.prefix });
    var fontsize = stagewidth > 500 ? 18 : 15;
    var that = this;
    var dialog = new Kinetic.R9Dialog({
        x: stagewidth / 2,
        y: stageheight / 2,
        opacity: 1,
        title: title,
        message1: message1,
        message2: message2,
        message3: message3,
        fontSize: fontsize
    });

    dialog.on('tap click', function () {
        dialog.remove();
        if (follow) that.showMessageBorder2(dnclayer, messageid, follow, [],  
        		stagewidth, stageheight, 0, 0, 'Cloud', duration, resumeAnimation, langCode, rate );
        else if (resumeAnimation) that.PageBus.publish('r9.core.animation.resume', { 'messageid': messageid, 'prefix': This.prefix });
    });

    dnclayer.add(dialog);

    var tween = new Kinetic.Tween({
        node: dialog,
        opacity: 1,
        easing: Kinetic.Easings['Linear'],
        duration: duration,
        onFinish: function () {

        }
    });
    tween.play();

};
//nodeList: [ { otext: style: x: y: w: h:  xoff: yoff ,fs, follow, timeline, hotpage, concept }]
R9StudioStage.prototype.showOptionsDialog = function (dnclayer, messageid, nodeList,  strokeColor, scr, scg, scb,
		bgr,bgg, bgb, fontSize, w, h, resumeAnimation, langCode,    
        pos, pageid, prefix, topicId, subtopic, noTTS ) { 
	var nodes = [];
    if (!prefix) prefix = "";
    var page = this.getCurPage(); page.mdstarted = true;
    var _this = this;
    var bgrect = new Kinetic.R9Rect(r9figure({
    	 width:  w + 40, height: h + 40,  x : nodeList[0].x - 20, y: nodeList[0].y -20,
    	 corner: 10, fillAlpha:0.6, fill: 'gray'
    }));
    dnclayer.add(bgrect);
    bgrect.opacity(0);
    nodes.push(bgrect);
    nodeList.forEach(function(n){
		// var n = nodeList[i];
	     var anode = new Kinetic.R9Text(r9figure({
	       width: n.w, height: n.h, r9textstyle: n.style, otext: n.otext,
	        x: n.x, y: n.y, fontSize: n.fs || 18,  
	        strokeWidth: 1, corner: 2, 
	        textXOffset: n.xoff, scaleX: 0.1, scaleY: 0.1, textYOffset: n.yoff,
	        fr: bgr, fg: bgg, fb: bgb, sr: scr, sg: scg, sb: scb, strokeAlpha:1, fillAlpha:1,  useBackground:1 
	    }));
	     anode.on('click tap', function() {
	    	 for(var j in nodes){   
	    		 (function (node) {
		    		 new Kinetic.Tween({ node: node, opacity:0.3, duration: 0.5, onFinish:function(){
		    			 node.remove();
		    	     }}).play(); 
	    		 })(nodes[j]);
	    	 }
	         if ( n.follow ){ 
	         	 _this.showMessage(dnclayer, messageid,  n.follow, 0, 0, 2, resumeAnimation, langCode,
	        			 '', pos, prefix, topicId, subtopic);
	         }
	         if( typeof n.hotpage == 'function' )
	        	 n.hotpage();
	        	 
	         if( n.concept )
	        	 _this.PageBus.publish( 'r9.core.study.score.report', n.concept );
	         if ( n.timeline  )
	        	 _this.PageBus.publish( 'r9.core.animation.timeline', { 'timeline' : n.timeline   });
	      
	     });
	     dnclayer.add(anode);
	     anode.opacity(0);
	     nodes.push(anode);
    }); 
	for(var i in nodes){
		 new Kinetic.Tween({
	        node: nodes[i],
	        opacity: i==0 ? 0.6 : 1,  
	        scaleX: 1, scaleY: 1,
	        duration: 0.5,
	        onFinish: function () {
	        	if(i == 4 &&  !noTTS ){
	        		_this.ttssetup(page, pos, pageid, prefix, _r9norm(nodeList[1].otext),
	      		            langCode, false, true, topicId, subtopic, function () {  }, '', true);
	      	} 
          }
        }).play();
	}
	
};
