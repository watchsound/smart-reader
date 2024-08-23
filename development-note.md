# install codebase
https://electron-react-boilerplate.js.org/docs/installation
> git clone --depth=1 \
  https://github.com/electron-react-boilerplate/electron-react-boilerplate \
  smart-reader-v2

# Install dependencies:
> npm install

> npm run build:renderer
> npm run build:main

> code --install-extension dbaeumer.vscode-eslint
> code --install-extension dzannotti.vscode-babel-coloring
> code --install-extension EditorConfig.EditorConfig

# Add better-sqlite3 
reference: https://github.com/amilajack/erb-better-sqlite3-example
           https://electron-react-boilerplate.js.org/docs/native-modules
> cd .release/app
> npm install better-sqlite3

1. in package.json > scripts > rebuild, add:
  && electron-rebuild -f -w better-sqlite3
2. in .erb/configs/webpack.config.renderer.dev.dll , add:
   externals: [ .....  'better-sqlite3']
3. in toplevel package.json > devDependencies, add
        "@types/better-sqlite3": "^7.4.2",   
    //this version number is from website https://github.com/amilajack/erb-better-sqlite3-example/blob/56a4d94a66eaf2e983758ea856fd21dd198c027c/package.json#L165

## create database.
> sqlite3 sqlite_tables.db     #sql statement in a  db.sql file
in package.json , add :
   "extraResources": [
            "./sqlite_tables.db"
        ]
## sqlite and json:
https://dadroit.com/blog/sqlite-json/

## populate database 
> sqlite3 sqlite_tables.db
then paste sql statements from db.sql.

##### add AI package #####
## add  open ai  support
sample project: https://github.com/deiucanta/chatpad
> npm install openai
> npm install openai-ext
> npm install gpt-token-utils
 
## add support for Gemini and More AI provider
> npm install @google/generative-ai@0.1.3  
// need to use version @0.1.3 to match chromadb
 
## add claude api support
//https://www.npmjs.com/package/@anthropic-ai/sdk?activeTab=readme
> npm i @anthropic-ai/sdk

## add baidu api support
(https://www.npmjs.com/package/@baiducloud/qianfan)
> npm i @baiducloud/qianfan


##  add mindmap support
> npm i reactflow

> npm i natural
<!--
> BREAKING CHANGE: webpack < 5 used to include polyfills for node.js core modules by default.
>  This is no longer the case. Verify if you need this module and configure a polyfill for it.
-->

>  npm install axios cheerio

## json parser,  builtin is too strict
> npm install json5

>  npm install file-saver
> npm install react-device-detect
>  npm install react-hot-toast
> npm install uuid
> npm install mammoth
> npm install buffer
> npm install adm-zip
> npm install fs-extra
// https://www.npmjs.com/package/xlsx
> npm i xlsx 
> npm install epubjs
>  npm install electron-store

### pdf view lib related choices: 
pdfjs-dist use canvas in nodejs enviroment, and canvas is a native module.
but i already use pdf.js at render process, which is pdf.js is the core library used by pdfjs-dist.
decision:  
Yes, you can use pdf.js in the renderer process and pdf-parse in the main process in your Electron-React-Boilerplate (ERB) project  
https://www.npmjs.com/package/pdf-parse
> npm i pdf-parse 

# add offline view --- save as pdf
// design: save pdf in a local file system, with bookmarkid as file name.
> npm install puppeteer-core
>  npm i chrome-finder
> npm install node-fetch
> npm install say


## add markdown
https://nextjs.org/docs/app/building-your-application/configuring/mdx
first used : https://www.npmjs.com/package/markdown
but it does not provide extensive support, for example newline break
so finally i select: https://www.npmjs.com/package/markdown-it
markdown-it provide support for new line break and more..
> npm install markdown-it
.... add plugin
::::math
https://www.npmjs.com/package/markdown-it-texmath
// i tried both,  markdown-it-katex markdown-it-mathjax3
// but finally use this one:
> npm i katex
> npm i markdown-it-texmath

::::color
https://www.npmjs.com/package/markdown-it-color
> npm i markdown-it-color
::::link
https://www.npmjs.com/package/markdown-it-replace-link
> npm i markdown-it-replace-link

> npm install highlight.js


# add vector db
//https://docs.trychroma.com/getting-started
> npm install --save chromadb
> pip install chromadb   # You will need to install the Chroma python package to use the Chroma CLI and backend server.
 
// You will need to install the Chroma python package to use the Chroma CLI and backend server.
in a separate terminal:
> cd c:/workspace-ai-education
> chroma run --path chroma        # chroma is a directory created

> npm install jsdom 
// still jsdom has dependency on canvas,  how to avoid canvas?
https://github.com/jsdom/jsdom/issues/1708
The trick is to tell webpack to provide an empty stub of canvas: 
    externals: {
        ...
        canvas: '{}',
    },
Note the quotes around the braces. This creates an empty object. If you use {}, you wind up getting an error "Cannot read property 'createCanvas' of undefined".



## add support for microsoft word
there are two powerful tools :  Pandoc and LibreOffice.
but both need additiona setup step,  which should be avoided in this project.
one approach is to use Mammoth.js to convert doc to html, then use epub-gen to 
convert from html to epub.  the problem with this approach is ---
convert may lose original layout information of doc. 

so we use LibreOffice. 
1. install libreoffice in /Applications (Mac), with your favorite package manager (Linux), or with the msi (Windows).
https://www.libreoffice.org/download/download-libreoffice/
2. 
> npm i libreoffice-convert

3. in case user did not install libreoffice, we will use  Mammoth.js to convert doc to html, then use epub-gen to  convert from html to epub.  
> npm i epub-gen


## add tts , use both web speech api and os-native approach
### first install say
https://www.npmjs.com/package/say
> npm i say
macOS: say command is built-in,  
Windows: Uses SAPI (Speech API), which is built-in,  
Linux: Requires TTS engines like espeak, festival, or flite.
1. Add a postinstall script in your package.json to handle the installation of dependencies for Linux.
"postinstall": "node .erb/scripts/install-deps.js",
2. Create the install-deps.js Script


# epub support
> npm install react-reader
## custom mark ..
#1. add marks-pane  //overlay of svg figure on top of epub iframe
> npm install marks-pane

# install material ui
https://mui.com/material-ui/getting-started/installation/
> npm install @mui/material @emotion/react @emotion/styled
> npm install @mui/icons-material

## for mui  add experiment api:
> npm install @mui/lab @mui/material

# migrate some lib from old code base / koodoo
> npm install @reduxjs/toolkit
> npm install redux-persist
> npm install react-redux 
> npm i underscore 
> npm install react-tagsinput
> npm install sort-by
> npm install match-sorter


## redux - event related
https://www.npmjs.com/package/redux-watch
> npm i redux-watch
> npm i is-equal

## create cover image for epub
>npm i html2canvas

## books, book shelf  , books view
> npm install moment --save
> npm install date-fns --save
> npm install path-browserify     #for node.js path issue, it does not availble in browser.

# a problem :
Module not found: Error: Can't resolve 'zlib' in 'C:\workspace-ai-education\electron-react\ereader\node_modules\adm-zip\methods'
BREAKING CHANGE: webpack < 5 used to include polyfills for node.js core modules by default.
This is no longer the case. Verify if you need this module and configure a polyfill for it.
If you want to include a polyfill, you need to:
        - add a fallback 'resolve.fallback: { "zlib": require.resolve("browserify-zlib") }'
        - install 'browserify-zlib'
If you don't want to include a polyfill, you can use an empty module like this:
        resolve.fallback: { "zlib": false }
>>>
solution:
1. in .erb/configs/webpack.config.base.ts
add :  resolve.fallback: { "zlib": require.resolve("browserify-zlib") }
2. > npm install browserify-zlib


#############################
## add custom hyper link globally
## design:  add custom link to markdown,
            intercept event.
> npm i linkify-it


###############################
## add quiz ui support .
## design: use survey.js  because i had used it in several projects (QuizCreator)
https://surveyjs.io/form-library/documentation/get-started-react
> npm install survey-react-ui --save

## add a moodboard support
// https://www.npmjs.com/package/react-grid-layout
> npm install react-grid-layout
> npm install react-resizable

// https://github.com/projectstorm/react-diagrams
> npm i @projectstorm/react-diagrams

## add slider view for note list
// https://www.npmjs.com/package/react-slick
> npm install react-slick --save

Also install slick-carousel for css and   
> npm install slick-carousel

// Import css files
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css"

# add treeview
> npm install @mui/x-tree-view
 

## emoji support
https://www.npmjs.com/package/emoji-mart
> npm i emoji-mart
> npm i @emoji-mart/react
design concern: config commonly used emoji at setting page. (emoji at study page should be minimum)


###### ### ########################## 
## pdf support 

# install  react-pdf-highlighter-extended-x2
> npm i react-pdf-highlighter-extended-x2


#### ### #########
##  add json dynamic support?
> npm install json-schema-generator ajv


## add impressjs support
// dont use react-impressjs :  as it mess up with react-route .  

 
## fix error:
ReferenceError process is not defined
> npm install process



## grammar view 
//  https://mcamac.github.io/react-text-annotate-blend/
>   npm i react-text-annotate-blend

// add annotation to html content
// https://www.npmjs.com/package/text-annotator-v2#comparing-text-annotator-v2-and-text-annotator
> npm i text-annotator-v2

## change index.tsx to index.html and main.jsx in
webpack.config.renderer.dev.ts
webpack.config.renderer.prod.ts

> npm i handlebars
> npm i styled-components

## note: do not use electron-rebuild, it is deprecated. use @electron/rebuild.
https://www.npmjs.com/package/@electron/rebuild
> npm install --save-dev @electron/rebuild

> npm install constants-browserify
> npm install crypto-browserify 
> npm install https-browserify
> npm install os-browserify
> npm install path-browserify
> npm install stream-browserify
> npm install vm-browserify
> npm install stream-http
> npm i url

## ~~~~~~~~~~~~ package ~~~~~~~~~~~~~~~~~
## sqlite3
1. copy sqlite_tables.db to release\app
2. change dbManager.js code
// 
2.1 copy sqlite_tables.db to a writable location


## ~~~~~~~~~~~~ install extra step ~~~~~~~~~~~~~~~~~
1. for chroma
> pip install chromadb   # You will need to install the Chroma python package to use the Chroma CLI and backend server.
2. TTS
Linux: Requires TTS engines like espeak, festival, or flite.
3. WORD support
install libreoffice in /Applications (Mac), with your favorite package manager (Linux), or with the msi (Windows).
https://www.libreoffice.org/download/download-libreoffice/




############################################################
# server side, library management system.
C:\workspace-ai-education\librarymanagementsystem

this is from development-note.txt of this project
### change db to mysql.
1. create a database with name booklibrary;
2. 

### if i change database to mysql,  
https://chat.openai.com/share/ad3e2505-8106-4272-86a8-4fc0482c5b56

### datamodel changes
add annotation, annotations,  
add coverimage to book.
save book file to sever side.

### create a separate annotation project based on reactjs.
1.  npx create-react-app book-annotator
2.  cd book-annotator
3.  npm install react-pdf-highlighter pdfjs-dist
4...see deveopment-note.txt for this project.

############################################################

##############################################################
## create pdf highlighter module and push to npm
// https://github.com/agentcooper/react-pdf-highlighter
>    
this is demo https://agentcooper.github.io/react-pdf-highlighter/#highlight-019837609945882795
this is corresponding data model used in demo: 
https://github.com/agentcooper/react-pdf-highlighter/blob/main/example/src/test-highlights.ts

design concern: 
write code to map between data model in react-pdf-highlighter and Note object.

// > npm i react-pdf-highlighter
// react-pdf-highlighter has very old version of pdfjs-dist dependency 
// so , i did not use  npm install pdfjs-dist

This is from project react-pdf-highlighter-extended which is forked from react-pdf-highlighter.
just minor changes 
1. react-pdf-highlighter-extended removed emoji which is supported by react-pdf-highlighter. i added it back.
2. add some extra field to Highlight data model  
3. add support for color setting and some built-in annotation types.
colors:  
  'primary',
  'secondary',
  'error',
  'warning',
  'info',
  'success',
annotations:
  Highlight ,
  Underline ,
  StrikeLine ,
  DashLine,

# react-pdf-highlighter-extended publish to npm
in package.json rename project to react-pdf-highlighter-extended-x2
1. checkout code to react-pdf-highlighter-extended
2. modify code 
3.  npm install .\react-pdf-highlighter-extended\
4.  cd .\react-pdf-highlighter-extended\
5.  npm publish      

# react-pdf-highlighter-extended publish to github
1. Create a New Repository on GitHub: react-pdf-highlighter-extended-v2
2. Update Your Local Repository Settings:
   git remote remove origin
   git remote add origin https://github.com/watchsound/react-pdf-highlighter-extended-v2.git
3. Push Your Changes:
  git add .
  git commit -m "Your commit message"
git push -u origin main

#####################################################################
