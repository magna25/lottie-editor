import React from 'react';
import './assets/css/style.css';
import {ChromePicker} from 'react-color';
import lottie from 'lottie-web'
import {parseColors, assignNewSolidColor, assignNewGradientColor} from './editor'
import {MdVpnKey, MdKeyboardArrowDown, MdPlayArrow, MdUndo, MdRedo, MdFileDownload, MdClearAll, MdPause, MdEdit} from 'react-icons/md'
import {FaGithub} from 'react-icons/fa'
import { Scrollbars } from 'react-custom-scrollbars';
import Slider from 'react-input-slider'
import FileDrop from 'react-file-drop'
import {saveAs} from 'file-saver'
import {inject, observer} from 'mobx-react'
import {toJS} from 'mobx'



const sketchPickerStyles = {
  default: {
    picker: { // See the individual picker source for which keys to use
      boxShadow: 'none',
      //padding:0
      width:'100%',
     
    },
  },
}
//support undo/redo
let undoStack = []
let redoStack = []
let initAnimation = null
let initState = {}

class Editor extends React.Component {
  state = {
    data: null,
    parsedColors:null,
   
    colorPickerBackground: [0,0,0,1],
    
    current_layer: null,
    rootLayerPath:null,
    rootItemName:null,
    layer_open:false,
    activeGroupId:null,

    keyFramed:false,
    keyFramedColorType:null,
    keyFramedColorIndex:null,

    isGradient:false,
    gradientIndex:null,
   
    currentFrameTime:0,
    totalTime:0,
    paused:false,

    animationPreviewBackgroundColor:'#fff',
    backgroundColorPickerVisible:false,
    currentView:0,//0:show file drop,1: show loading,2:render animation
    fetchError:false
  }
  
  componentDidMount(){
    initState = JSON.parse(JSON.stringify(this.state)) //for redo/undo and clear all 
    let search = window.location.search;
    let params = new URLSearchParams(search);
    let url = params.get('src')
    let demo = false
    if(!url){
        demo = true
        url = 'https://assets5.lottiefiles.com/packages/lf20_nz20vA.json'
    }
   
    this.setState({currentView:1})
    fetch(url)
    .then(async resp => {
      //lottiefiles website returns plain text so get that first and parse
      let body = await resp.text() 
      try{
        
        const res = JSON.parse(body)
        
        //check some properties to see if is a valid lottie json file..
        //not meant to be foolproof -- just to catch mistakes
        if('v' in res && 'ip' in res && 'op'){
          if(demo){
            this.initDemo(res)
          }
          else{
            this.loadNewAnimation(res)
          }
        }
        else{
          this.setState({currentView:0,fetchError:true})
        }
        
      }
      catch(err){
        this.setState({fetchError:true,currentView:0})
      }
    })
    .catch(err =>  this.setState({fetchError:true,currentView:0}))
   
    document.addEventListener('mousedown', this.hideBackgroundColorPicker)
    document.addEventListener("keydown", this.keyboardControls, false)
  }
  componentWillUnmount(){
    document.removeEventListener("keydown", this.keyboardControls, false)
    document.removeEventListener('mousedown', this.hideBackgroundColorPicker);
  }
  setColors = () => {
    const parsedColors = parseColors(toJS(this.props.Store.json),true)
    this.setState({parsedColors: parsedColors})
  }

  toggleLayer = (id) => {
    if(this.state.current_layer == id){
      this.setState({layer_open:!this.state.layer_open})
    }
    else{
      this.setState({current_layer:id,layer_open:true})
    } 
  }

  changeColor = (color,event) => {
    if(!this.state.activeGroupId) return
    const pickedColor = [color.rgb.r,color.rgb.g,color.rgb.b,1]
    const colorGroup = this.state.parsedColors[this.state.rootLayerPath][this.state.activeGroupId]
    let newData = null
    let colorProps = {
      items:colorGroup,
      pickedColor:pickedColor
    }
    //undo/redo
    const oldStateData = [this.state,toJS(this.props.Store.json)]
    if(undoStack.length < 10){
      undoStack.push(oldStateData)
    }
    else{
      undoStack.shift()
      undoStack.push(oldStateData)
    }
    redoStack = []
    
    if(this.state.keyFramed){
      colorProps.type = "keyed"
      colorProps.colorType = this.state.keyFramedColorType
      colorProps.oldColorIndex = this.state.keyFramedColorIndex

      if(this.state.isGradient){
        colorProps.gradientStartIndex = this.state.gradientIndex
        newData = assignNewGradientColor(toJS(this.props.Store.json),colorProps)
      }
      else{
        newData = assignNewSolidColor(toJS(this.props.Store.json),colorProps)
      }
    }
    else{
        colorProps.type = null
        if(this.state.isGradient){
          colorProps.gradientStartIndex = this.state.gradientIndex
          newData = assignNewGradientColor(toJS(this.props.Store.json),colorProps)
        }
        else{
          newData = assignNewSolidColor(toJS(this.props.Store.json),colorProps)
        }
    }
    
    this.props.Store.setJson(newData.animation)
    this.setState({
      parsedColors:newData.colors,
      activeGroupId:newData.key,
      colorPickerBackground:pickedColor.join(),
    }, 
      () => {
        this.lottieRender()
    })
  }
  setActiveColorKeyedSolids = (layerId,shapeId,colorObj,rootItemName,colorType) => {
    this.setState({
      rootLayerPath:layerId,
      isGradient:false,
      keyFramed:true,
      keyFramedColorType:colorType,
      activeGroupId:shapeId,
      keyFramedColorIndex:colorObj.index,
      rootItemName:rootItemName,
      colorPickerBackground:colorObj[colorType]
    },
    //() => lottie.goToAndStop()
    )
  }
  setActiveColorSolids = (colorProps) => { 
    this.setState({
      rootLayerPath:colorProps.layerId,
      activeGroupId:colorProps.shapeGroupId,
      isGradient:false,
      keyFramed:false,
      rootItemName:colorProps.rootItemName,
      colorPickerBackground:colorProps.color
    }
    )
   
  }
  
  setActiveColorKeyedGradient = (colorProps) => {
    this.setState({
      rootLayerPath:colorProps.layerId,
      activeGroupId:colorProps.shapeGroupId,
      isGradient:true,
      keyFramed:true,
      keyFramedColorIndex:colorProps.keyFramedColorIndex,
      keyFramedColorType:colorProps.colorType,
      gradientIndex:colorProps.gradientIndex,
      rootItemName:colorProps.rootItemName,
      colorPickerBackground:colorProps.gradient
    })
    
  }
  setActiveColorGradient = (layerId,shapeId,gradientColorI,rootItemName,gradientColorIndex) => {
    this.setState({
      rootLayerPath:layerId,
      isGradient:true,
      keyFramed:false,
      activeGroupId:shapeId,
      gradientIndex:gradientColorIndex,
      rootItemName:rootItemName,
      colorPickerBackground:gradientColorI
    })
  }
  updateCurrentFrame = (e) =>{
    this.setState({currentFrameTime:e.currentTime,totalTime:e.totalTime})
  }

  keyboardControls = (e)=>{
    if(e.keyCode == 32) this.playPause()
    else if(e.keyCode == 37 && this.state.currentFrameTime-1 >= 0) this.seekByArrowKeys(-1)
    else if(e.keyCode == 39 && this.state.currentFrameTime+1 <= this.state.totalTime) this.seekByArrowKeys(1)
    else if (e.keyCode == 90 && e.ctrlKey) this.undo()
    else if (e.keyCode == 89 && e.ctrlKey) this.redo()
  } 

  seekByMouseClick = (val) => {
    lottie.goToAndStop(val.x,true)
    if(!this.state.paused){
      lottie.play()
    }
  }
  seekByArrowKeys = (val) => {//seek using arrow keys or clicking on the track
    let currentFrame = this.state.currentFrameTime + val
    lottie.goToAndStop(currentFrame,true)
    if(!this.state.paused){
      lottie.play()
    }
  }
  playPause = () => {
    if(this.state.currentView != 2) return
    let playButtonState = null
    if(this.state.paused){
      lottie.goToAndStop(this.state.currentFrameTime,true)
      lottie.play()
      playButtonState = false
    }
    else{
      lottie.goToAndStop(this.state.currentFrameTime,true)
      playButtonState = true
    }
    this.setState({paused:playButtonState})
    
  }
  clearAllChanges = () => {
    if(undoStack.length == 0) return
    
    this.props.Store.setJson(initAnimation)
    redoStack = []
    undoStack = []
    this.setState(
      {...initState,...{currentView:2}}
      ,()=>{
        this.setColors()
        this.lottieRender()
      }
      )
  }
  undo = () => {//supports up to 10 levels
    if(undoStack.length == 0) return
    const prevAnimation = undoStack.pop()
    redoStack.push(prevAnimation)
    redoStack.push([this.state,toJS(this.props.Store.json)])
    
    this.props.Store.setJson(prevAnimation[1])
    this.setState(
      {...prevAnimation[0],...{animationPreviewBackgroundColor:this.state.animationPreviewBackgroundColor}}
      ,()=>{
        this.setColors()
        this.lottieRender()
      }
    )
   
  }
  redo = () => {//supports up to 10 levels
    if(redoStack.length == 0) return
    let current = redoStack.pop()
    let undo = redoStack.pop()
    undoStack.push(undo)
    this.props.Store.setJson(current[1])
    this.setState(
      {...current[0],...{animationPreviewBackgroundColor:this.state.animationPreviewBackgroundColor}},
      ()=>{
        this.setColors()
        this.lottieRender()
      }
    )
  }
  toggleBackgroundColorPicker = () => {
    this.setState({backgroundColorPickerVisible:!this.state.backgroundColorPickerVisible})
  }
  changeBackgroundColor (color,e){
    this.setState({
      animationPreviewBackgroundColor:color.hex
    })  
  }
  hideBackgroundColorPicker = (e) => {
    if (this.wrapperRef && !this.wrapperRef.contains(e.target)) {
      this.setState({backgroundColorPickerVisible:false})
    }
  }
  setWrapperRef = (node) => {
    this.wrapperRef = node
  }
  initDemo = (animation) =>{
    initAnimation = animation
    this.props.Store.setJson(animation)
    this.setState({currentView:0})
  }
  
  loadNewAnimation = (animation) => {
    initAnimation = animation
    this.props.Store.setJson(animation)
    this.setState(
      {currentView:2,fetchError:false},
      ()=>{
        undoStack = []
        redoStack = []
        this.setColors()
        this.lottieRender()
      }
      )
    
  }
  parseAndLoadNewAnimation = (e) => {
    const newAnimation = JSON.parse(e.target.result)
    this.loadNewAnimation(newAnimation)
  }

  handleFileDrop = (files,e) => {
    const reader = new FileReader()
    reader.onload = this.parseAndLoadNewAnimation;
    reader.readAsText(files[0])
  }

  downloadFile = ()=>{
    if(this.state.currentView != 2) return  
    const data = toJS(this.props.Store.json)
    const blob = new Blob([JSON.stringify(data)])
    saveAs(blob,data.nm+'.json')
  }
  switchEditMode = () => {
    this.setState(
     {currentView:2,fetchError:false},
      () => {
        this.setColors()
        this.lottieRender()
      }
    )
   
  }
  
//----------renders----------------------------
//---------------------------------------
  backgroundColorPicker(){
    if(this.state.backgroundColorPickerVisible){
      return (
        <div ref={this.setWrapperRef}>
        <div className="background-color-picker">
        <ChromePicker
          color={this.state.animationPreviewBackgroundColor}
          onChange={(e) => this.changeBackgroundColor(e)}
        /> 
        </div>
        </div>
      )
    }
    return ""
  }

  buildKeyedSolidsList = (items,key) => {
    let rootItemName = items[1].itemName.split('->')[0].trim()
    let expand = true
    if(expand){
      return (
        <div style={{background: 'rgba(0, 0, 0, 0.09)'}}>
          <div style={{padding:'8px 0 8px 30px',borderBottom:'1px solid rgba(0,0,0,.05)',borderTop:'1px solid rgba(0,0,0,.05)'}}><MdKeyboardArrowDown/> {items[0] + ' -> ' + rootItemName} <MdVpnKey size={13}/></div>
          <ul>
            {
              items[1].color.map(v =>
                <li>
                  <div onClick={() => {this.setState({paused:true});lottie.goToAndStop(v.time+1,true)}} style={{padding:'5px 0 5px 50px',borderBottom:'1px solid #ddd'}}> <MdKeyboardArrowDown/> t = {v.time + 1}</div>
                {
                 
                  <ul>
                    <li onClick={() => this.setActiveColorKeyedSolids(items[1].layerId,key,v,rootItemName,'start')} style={{fontSize:12,padding:5,marginLeft:100,background:'rgba('+v.start.join()+')'}}>Start color</li>
                    <li onClick={() => this.setActiveColorKeyedSolids(items[1].layerId,key,v,rootItemName,'end')} style={{fontSize:12,padding:5,marginLeft:100,background:v.end[3] == 0? '#fff': 'rgba('+v.end.join()+')'}}>End color</li>
                  </ul>
                }
                </li>  
              )
            }
          </ul>
        </div>
      )
    }
    return (
      <div>{items[0]}</div>
    )
  }

  buildKeyedGradientListColorList = (colorProps,color_type,gradient_colors) => {
    const gradients = this.groupGradient(gradient_colors)
    return (
      <ul>
        {gradients.map((gradient,i)=>
            <li 
              onClick={() => this.setActiveColorKeyedGradient({
                  rootItemName:colorProps.rootItemName,
                  gradientIndex:i,
                  gradient:gradient,
                  layerId:colorProps.layerId,
                  shapeGroupId:colorProps.shapeGroupId,
                  colorType:color_type,
                  keyFramedColorIndex:colorProps.keyFramedColorIndex
                })} 
              style={{padding:8,marginLeft:20,background:'rgba('+gradient.map((v,i)=>i==3?1:v).join()+')'}}
            >
              Gradient  {i+1}
            </li>
        
        )}
      </ul>
    )
  }

  buildKeyedGradientList = (item,key) => {
    let rootItemName = item[1].itemName.split('->')[0].trim()
    let expand = true

    if(expand){
      return (
        <div style={{background: 'rgba(0, 0, 0, 0.09)'}}>
          <div style={{padding:'8px 0 8px 30px',borderBottom:'1px solid rgba(0,0,0,.05)',borderTop:'1px solid rgba(0,0,0,.05)'}}><MdKeyboardArrowDown/> {item[0] + ' -> ' + rootItemName} <MdVpnKey size={13}/></div>
          <ul>
            {
              item[1].color.map((v,i) => {
                return (
                  <li>
                    <div onClick={() => lottie.goToAndStop(v.time+1,true)} style={{padding:'5px 0 5px 50px',borderBottom:'1px solid #ddd'}}> <MdKeyboardArrowDown/> t = {v.time + 1}</div>
                  {
                  
                    <ul>
                      <li style={{fontSize:12,padding:5,marginLeft:60,}}>
                      <div style={{padding:10}}><MdKeyboardArrowDown/> Start color</div>
                      {
                        this.buildKeyedGradientListColorList({
                          rootItemName: rootItemName,
                          layerId: item[1].layerId,
                          shapeGroupId:key,
                          keyFramedColorIndex:i
                        },'start',v.start)
                      }
                      </li>
                      <li style={{fontSize:12,padding:5,marginLeft:60,}}>
                      <MdKeyboardArrowDown/> End color
                      {this.buildKeyedGradientListColorList({
                        rootItemName: rootItemName,
                        layerId: item[1].layerId,
                        shapeGroupId:key,
                        keyFramedColorIndex:i
                      },'end',v.end)}
                      </li>
                    </ul>
                  }
                  </li>  
                )}
              )
            }
          </ul>
        </div>
      )
    }
    return (
      <div>{item[0]}</div>
    )
  }
  groupGradient = (arr) => {
    let gradients = [];
    arr.forEach((e,i) => {
      const last = gradients[gradients.length - 1];
      if (!last || last.length === 4) {
        gradients.push([e]);
      } else {
        last.push(e);
      }
    }); 
    return gradients
  }
  buildGradientList = (item,key) => {
    let rootItemName = item[1].itemName.split('->')[0].trim()
    let gradients = this.groupGradient(item[1].color)
    
    return (
      <div>
        <div style={{padding:'8px 0 8px 40px'}}>{item[0]}</div>
        <ul>
          {gradients.map((gradient,i) => 
            <li onClick={()=> this.setActiveColorGradient(item[1].layerId,key,gradient,rootItemName,i)} style={{padding:5,marginLeft:60,background:'rgba('+gradient.join()+')'}}>
              Gradient {i+1}
            </li>
            )}
        </ul>
      </div>
    )
  }
  
  buildSolidsList = (item,shapeId) => {
    let rootItemName = item[1].itemName.split('->')[0].trim()
    return (
      <div style={{background:'rgba(0,0,0,.10)'}}>
      <ul>
        <li
          key={shapeId}
        onClick={() => this.setActiveColorSolids(
          {
            rootItemName:rootItemName,
            layerId:item[1].layerId,
            shapeGroupId:shapeId,
            color:item[1].color
          }
          )}  
        style={{fontSize:12,marginLeft:30,padding:5,background:'rgba('+item[1].color.join()+')'}}>{item[0] +' -> '+ rootItemName}</li>
      </ul>
      </div>
    )
  }

  buildShapesList = (layer,layerId) => {
    let shapes = Object.keys(layer).filter(key=> key != "layerName")
   
    if(this.state.current_layer == layerId && this.state.layer_open){
        return (
          <div>
            <div onClick={() => this.toggleLayer(layerId)} className="layerRoot">
            <div><span className="playArrowDown"><MdPlayArrow  size={15}/></span> {layer.layerName}</div>
            </div>
          <ul>
            {
              shapes.map((key,i) => {
                if(layer[key][1].keyFramed){
                  if(layer[key][1].type == 'gf' || layer[key][1].type == 'gs'){
                    return this.buildKeyedGradientList(layer[key],key)
                  }
                  else{
                    return this.buildKeyedSolidsList(layer[key],key)
                  }
                }
                else{
                  if(layer[key][1].type == 'gf' || layer[key][1].type == 'gs'){
                    return this.buildGradientList(layer[key],key)
                  }
                  else{
                    return this.buildSolidsList(layer[key],key)
                  }
                }

              })
            }
          </ul>
          </div>
        )
    }
    return (
      <div onClick={() => this.toggleLayer(layerId)} className="layerRoot">
            <div><MdPlayArrow size={15}/> {layer.layerName}</div>
            </div>
    )
  }

  renderParsedColors = () =>{
    
    if(this.state.parsedColors == null) return null
    
    let layers = Object.keys(this.state.parsedColors).reverse();
    //console.log(layers)
    return (
      <Scrollbars
      autoHide
      autoHideTimeout={1000}
      autoHideDuration={200}
       
       className="parsedColorsWrapper" >
      <div >
        <ul>
          {
            layers.map((key,i)=>
              <li key={this.state.parsedColors[key].layerName} className="parsedColorItem">
                {this.buildShapesList(this.state.parsedColors[key],i)}
              </li>
              )
          }
        </ul>
      </div>
      </Scrollbars>
    )
  }

  lottieRender = () => {
    lottie.destroy()

    let animation = lottie.loadAnimation({
      container: document.getElementById("preview"), 
      renderer: "svg",
      loop: true,
      autoplay:true,
      animationData: toJS(this.props.Store.json),
    });
    if(this.state.paused) animation.goToAndStop(this.state.currentFrameTime,true)
    animation.addEventListener('enterFrame',this.updateCurrentFrame)
    
  }

  renderAnimation(){
    if(this.state.currentView == 2){
      return (
        <div ref={this.animationRef} id="preview"/>
      )
    }
    else if(this.state.currentView == 1){
      return (
        <div>
          Loading...
        </div>
      )
    }
    return (
      <div className="drop-files-wrapper">
          <p>Drag and drop lottie files here or </p><br/><br/>
          <div onClick={() => this.switchEditMode()} className="button">
          Edit demo
         
          <span><MdEdit/></span>
        </div>
      </div>
    )
  }
  showFetchError = ()=>{
    if(this.state.fetchError) {
      return (
        <div className="fetch-error"><span>Couldn't fetch json data from provided url. Drag and drop the file above</span></div>
      )
    }
  }
  render() {
  return (
    
    <div className="main">
      <div className="sidebarWrapper">
      <div className="colorPicker">
          <ChromePicker  
            color={ 'rgba('+this.state.colorPickerBackground+')'}
            onChangeComplete={this.changeColor} 
            styles={sketchPickerStyles}
          />
         
        </div>
       
        {this.renderParsedColors()}

      </div>
      <div className="previewWrapper">
        <a target="_blank" href="https://github.com/magna25/lottie-editor" id="github-link"> <p><FaGithub/></p> <p>v1.0.1</p></a>

        <div className="previewContainer"  style={{background:this.state.animationPreviewBackgroundColor}}>
            <FileDrop onDrop={this.handleFileDrop}>
            {this.renderAnimation()}
            </FileDrop>
        </div>
      
        
        <div className="previewControls">
          {this.showFetchError()}
          <div className="controls" style={{padding:20}}>
            <div><MdFileDownload onClick={() => this.downloadFile()} color={this.state.currentView != 2?'gray':'#000'} title="Download" size={25}/></div>
            <div onClick={() => this.clearAllChanges()}><MdClearAll color={undoStack.length == 0?'gray':'#000'} title="Clear All" size={25}/></div>
            <div onClick={() => this.undo()}><MdUndo color={undoStack.length == 0?'gray':'#000'}title="Undo" size={30}/></div>
            <div onClick={() => this.redo()}><MdRedo color={redoStack.length == 0?'gray':'#000'} title="Redo" size={30}/></div>
            <div onClick={() => this.playPause()}>{!this.state.paused ? <MdPause color={this.state.currentView != 2?'gray':'#000'} title="Pause" size={30}/> : <MdPlayArrow color={this.state.currentView != 2?'gray':'#000'} title="Play" size={30}/>}</div>
            <div>
              <div>{this.state.currentFrameTime < 10? '0'+Math.round(this.state.currentFrameTime):Math.round(this.state.currentFrameTime)}/{this.state.totalTime}</div>
              <div className="controls-slider">
                <Slider
                  styles={{
                    track: {
                      width:'100%',
                    },
                    active: {
                      backgroundColor: 'gray'
                    },
                  }}
                  y
                  xmax={this.state.totalTime}
                  x = {this.state.currentFrameTime}
                  onChange={this.seekByMouseClick}
                />
              </div>
            </div>
            <div style={{background:this.state.animationPreviewBackgroundColor}} onClick={() => this.toggleBackgroundColorPicker()}> BG</div>
          </div>
          {this.backgroundColorPicker()}
        </div>
        
      </div>
    </div>
    
  );
  }
}

const LottieEditor = inject('Store')(observer(Editor))
export default LottieEditor;
