# lottie-editor
Edit lottie animation colors https://magna25.github.io/lottie-editor/

A simple web tool that parses a lottie json file and allows editing the layer colors.
The tool supports:
  * Grouping each color by layer name and group name
  * Editing solid colors
  * Editing gradients
  * Editing keyframed colors (both solids and gradients)
  * up to 10 levels of undo/redo history
  * keyboard shortcuts for play/pause, seek forward/backward
  * Drag and drop files
  * loading lottie file from url (get a link from lottiefiles and provide the source url. ex /?src="animation_url")

The whole app runs on the client and any uploaded animation isn't saved on a server.
 <br/>
<br/>
<br/>
<br/>


 ![](github_demo.gif)
 
 <br/>
<br/>
<br/>


 ### Browser support
 This was developed and tested on Chrome but it should work work any modern browser. Firefox has a flex issue so the UI is a little bit
 messed up but the functionality is not affected.  
 
 <br/>
<br/>
<br/>


### Known issues
Some lottie json files have inconsistent properties which cause the colors not to be parsed, for ex. there are layers embeded in another layers. This hopefully will be patched on the next release.  
 
<br/>
<br/>
<br/>

 
 ### Todo
 handle layers embeded inside another layers
 refactor code
 

 
 
