// import axios from "axios";
// import { load as cheerio_load } from "cheerio";
// import { Ollama } from "ollama";

// import {
//   parseJsonFromLLM,
//   stripNumberAndDot,
//   getTimelinePrompt,
//   getNumberedStepsPrompt,
//   getFlowchartPrompt,
//   getTablePrompt,
//   getNetworkGraphPrompt,
//   getComparisonChartPrompt,
//   getMindMapPrompt,
//   queryOllamaWithReturnJson,
//   getMatchImagesToTimelinePrompt,
//   getMatchImagesToNumberedStepsPrompt,
//   getMatchImagesToMindMapPrompt,
// } from "./utils.js";
// import { scrapeBing } from "./bing-direct-query.js";
// import { scrapeGoogle } from "./google-direct-query.js";
// import {
//   fetchPage,
//   extractImagesFromMetadata,
//   extractProminentImages,
//   extractFallbackImages,
//   combineImages,
//   decomposeContent,
//   matchImagesToSections,
//   extractImageInfo,
//   assignImageToSectionsFromHtmlPage,
// } from "./web-image-utils.js";
// import {
//   site_categories,
//   mergeSearchResults,
//   semanticMatchWithOllama,
//   fetchAndExtractTextFromCache,
//   constructContextPrompt,
//   getMatchedCategoryAndDomains,
//   getClassificationForUI,
// } from "./web-query-utils.js";

// const ollama = new Ollama({ host: "http://127.0.0.1:11434" });


// async function processQuery(userQuery, ollama) {
//     //first query against google and bing
//    // const g1 = await scrapeGoogle(userQuery, 2);
//    // console.log("g1 = " +JSON.stringify(g1));
//     const g1 = [
//       {
//         title: "Photosynthesis - National Geographic Education",
//         link: "https://education.nationalgeographic.org/resource/photosynthesis/",
//         snippet:
//           "Jun 21, 2024 — Photosynthesis is the process by which plants use sunlight, water, and carbon dioxide to create oxygen and energy in the form of sugar.",
//       },
//       {
//         title: "Photosynthesis | Definition, Formula, Process, Diagram, ...",
//         link: "https://www.britannica.com/science/photosynthesis",
//         snippet:
//           "4 days ago — Photosynthesis is the process by which green plants and certain other organisms transform light energy into chemical energy.",
//       },
//     ];
//     // const b1 = await scrapeBing(userQuery, 2)
//     // console.log("b1 = " + JSON.stringify(b1));
//  const b1 = [
//    {
//      title: "Photosynthesis: Essay on Photosynthesis (2098 Words) - Biology …",
//      link: "https://www.biologydiscussion.com/photosynthesis/photosynthesis-essay-on-photosynthesis-2098-words/475",
//      snippet:
//        "Photosynthesis as an oxidation-reduction reaction: In 1931, С. B. Niel suggested that water is the hydrogen donor in the oxidation-reduction that occurs in photosynthesis. The ratio of oxygen evolved to carbon dioxide consumed is one. The over all reaction of photosynthesis is — nН 2 О + nСО 2 → light / chlorophyll nO2+ (CH 2 O) n",
//    },
//    {
//      title:
//        "Top 11 Experiments on Photosynthesis in Plants - Biology Discussion",
//      link: "https://www.biologydiscussion.com/experiments/photosynthesis-experiments/top-11-experiments-on-photosynthesis-in-plants/21976",
//      snippet:
//        "ADVERTISEMENTS: The following points highlight the top eleven experiments on photosynthesis in plants. Some of the experiments are: 1. Simple Demonstration of Photosynthesis 2. To Study the ”Primary Photochemical Reaction” of Photo­synthesis 3. To Study the “Dark Reaction” of Photosynthesis 4. To Study the Essentiality of the Factors for the Photosynthetic Process and …",
//    },
//  ];
//   let searchResults = mergeSearchResults(g1,b1);
//   //image query
//   const urlToHtml = {};
//   const images = [];
//   const metaImages = [];
//   const b1p = searchResults.map(async (r) => {
//     if (!r || !r.link) return false;
//     try {
//       const html = await fetchPage(r.link);
//       if(!html) return false;
//       urlToHtml[r.link] = html;
//       const { combinedImages, metadataImages } = await extractImageInfo(html);
//       images.push(...combinedImages);
//       metaImages.push(...metadataImages);
//       return true;
//     } catch (error) { console.log(error)}
//   });
//   await Promise.all(b1p);

//   //get special sites
//   const result = await getMatchedCategoryAndDomains(userQuery, ollama);
//   console.log(result);
//   if( result.category ){
//     async function t(query) {
//         const b2 = await scrapeBing(query, 1);
//         const g2 = await scrapeGoogle(query, 1);
//         let m2 = mergeSearchResults(g2, b2);
//         const b2p = m2.map(async (r) => {
//         if (!r || !r.link) return false;
//         const has = searchResults.some((item) => item.link === r.link);
//         if (has)  return false;

//         try {
//             const html = await fetchPage(r.link);
//             if(!html) {
//                return false;
//             }
//             searchResults.push(r);
//             urlToHtml[r.link] = html;
//             const { combinedImages, metadataImages } = await extractImageInfo(html);
//             images.push(...combinedImages);
//             metaImages.push(...metadataImages);
//             return true;
//         } catch (error) {console.log(error);}
//         });
//         await Promise.all(b2p);
//     }
//     const userQuery2 = userQuery + " site:" + result.sites[0];
//     await t(userQuery2);
//     const userQuery3 = userQuery + " site:" + result.sites[1];
//     await t(userQuery3);
//   }

//     const imageConcise = images.map((image) => {
//       return {
//         src: image.src,
//         alt: image.alt,
//         title: image.title,
//         context: image.context || "",
//       };
//     });
//   // create report
//     const webContents = await fetchAndExtractTextFromCache(urlToHtml);
//     console.log("webContent = " + JSON.stringify(webContents));
//     // Step 2: Construct prompt for Ollama
//     const prompt = constructContextPrompt(userQuery, webContents);
//     console.log("prompt = " + prompt);
//     // Step 3: Query Ollama with the constructed prompt
//     const ollamaResponse = await queryOllamaWithReturnJson(prompt);
//     if(ollamaResponse){
//         console.log("ollamaResponse = " + JSON.stringify(ollamaResponse));

//         const sectionsWithImages0 = await matchImagesToSections(
//           imageConcise,
//           ollamaResponse,
//           ollama
//         );
//         console.log("sectionsWithImages0 = " + JSON.stringify(sectionsWithImages0));
//     } else {
//         console.log("ollamaResponse failed");
//     }


//   // add more view?
//   const { classification , reason } = await getClassificationForUI(
//     userQuery,
//     webContents,
//     ollama
//   );
//   let special_view_prompt = null;
//   if (classification === "timeline") {
//     special_view_prompt = getTimelinePrompt(userInput, context);
//   }
//   if (classification === "numbered_steps") {
//     special_view_prompt = getNumberedStepsPrompt(userInput, context);
//   }
//   if (classification === "flowchart") {
//     special_view_prompt = getFlowchartPrompt(userInput, context);
//   }
//   if (classification === "table") {
//    special_view_prompt = getTablePrompt(userInput, context);
//   }
//   if (classification === "network_graph") {
//     special_view_prompt = getNetworkGraphPrompt(userInput, context);
//   }
//    if (classification === "comparison_chart") {
//      special_view_prompt = getComparisonChartPrompt(userInput, context);
//    }

//    if(!special_view_prompt) {
//       special_view_prompt = getMindMapPrompt(userInput, context);
//    }
//    const special_view_ui = await queryOllamaWithReturnJson(special_view_prompt, ollama);
//     if (classification === "timeline") {
//       special_view_prompt = getMatchImagesToTimelinePrompt(
//         special_view_ui,
//         imageConcise
//       );
//     }
//     if (classification === "numbered_steps") {
//         special_view_prompt = getMatchImagesToNumberedStepsPrompt(
//         special_view_ui,
//         imageConcise
//         );
//     }
//      if (!classification) {
//        special_view_prompt = getMatchImagesToMindMapPrompt(
//          special_view_ui,
//          imageConcise
//        );
//      }
//      if(special_view_prompt){
//          const r = queryOllamaWithReturnJson(special_view_prompt, ollama);
//          console.log(` special_view_with_image = ${r}`)
//      }
// }

// // Example usage
// const userQuery = "What is photosynthesis?";

// processQuery(userQuery, ollama);
