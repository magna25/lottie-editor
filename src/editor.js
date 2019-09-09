import XXH from 'xxhashjs'

let newShapeGroupKeyHash = null

const toRGBADecimal = (arr) => arr.map((v,i)=>i!=3 && arr[3] != 0 ?Math.round(v*255):v)
const toRGBADecimalGradient = (arr) => {
	return arr.map((v,i)=> {
		if(i != 0 && v % 4 == 0){ 
			return v
		}
		else{
			return Math.round(v*255)
		}
	})
}

const generateNewKeyHash = (val) => {
	return XXH.h32(val, 0xABCD ).toString(16)
}

const findItemPath = (items) => {
	
	let path = []
	
	items.forEach((item,i) => {
		
		if('it' in item){
			let items = findItemPath(item.it)
			
			if(items.length > 0) {
				items = items.map(colorObj => {
					colorObj.itemPath.push(i)
					colorObj.itemName = 'nm' in item ? item.nm +' -> '+ colorObj.itemName: 'Item ' +i+ ' -> '+ colorObj.itemName
					return colorObj
				})
			}
			
			path = path.concat(items)
		}
		else if(item.ty == 'fl' || item.ty == 'st'){ //solid fill || stroke
			
			const itemName = 'nm' in item ? item.nm: item.ty == 'fl' ? 'Fill 1': 'Stroke 1'
			if(item.c.a == 0){
				const color = toRGBADecimal(item.c.k)
				path.push({type:item.ty,itemName:itemName, itemPath:[i], color:color, keyFramed:false})
			}
			else if(item.c.a == 1){ //color has keyframes
				let colors = []
				item.c.k.forEach((v,i) => {
					if('s' in v){
						const startColor = toRGBADecimal(v.s)
						//some json files don't have end color property, use 255 as a filler--not used for anything 
						//just allows the hash value to be start + end color
						const endColor =   'e' in v ? toRGBADecimal(v.e):[255,255,255,0] 
						colors.push({time:v.t,start:startColor,end:endColor,index:i})
					}
				})

				path.push({ type:item.ty,itemName:itemName, itemPath:[i],color:colors,keyFramed:true})
				
			}
		}
		else if(item.ty == 'gf' || item.ty == 'gs'){ //gradient fill/stroke
			const itemName = 'nm' in item ? item.nm: item.ty == 'gf' ? 'Gradient Fill 1': 'Gradient Stroke 1'
			if(item.g.k.a == 0){
				const color = toRGBADecimalGradient(item.g.k.k)
				path.push({type:item.ty,itemName:itemName, itemPath:[i], color:color, keyFramed:false})
			}
			else if(item.g.k.a == 1){ //gradient has keyframes
				let colors = []
				item.g.k.k.forEach((v,i) => {
					if('s' in v && 'e' in v){
						const startColor = toRGBADecimalGradient(v.s)
						const endColor =   toRGBADecimalGradient(v.e)
						colors.push({time:v.t,start:startColor,end:endColor,index:i})
					}
				})
				path.push({ type:item.ty,itemName:itemName, itemPath:[i], keyFramed:true,color:colors})
			}
		}
	})

	return path
}


const extractColors = (layers,rootLayersName,assetsIndex = null) => {
	let colors = []
	
	layers.forEach((v,i) => {
		if('layers' in v){ //layer embededded in layer
			//todo
		}
		else if("shapes" in v){
			let shapes = extractColors(v.shapes,rootLayersName,assetsIndex).map((val) => {
				val.layerId = rootLayersName +':'+ i + ':'+assetsIndex
				val.layerName = v.nm
				return val
			})
			colors = colors.concat(shapes)
			
		}
		else if("it" in v) {
			let items = findItemPath(v.it).map((val) =>{
				val.shapeId = i
				val.shapeName = v.nm
				
				return val
			})
			colors = colors.concat(items)
		}
		
	})
	return colors
}


const parseColors = (jsn, file=false) => {
	
	let parsed = file ? jsn: JSON.parse(jsn)
	
	let layers = {}

	extractColors(parsed.layers,'main').forEach((colorObj,i) => {
		let color = colorObj.keyFramed ? colorObj.color[colorObj.color.length - 1].start.join()+colorObj.color[colorObj.color.length - 1].end.join(): colorObj.color.join()
		let rootItemName = colorObj.itemName.split('->')[0].trim()
		let key = generateNewKeyHash(rootItemName+':'+color)
		let layerId = colorObj.layerId.toString()

		if(layers.hasOwnProperty(layerId)){
			if( key in layers[layerId]){
				layers[layerId][key].push(colorObj)
			}
			else{
				layers[layerId][key] = [colorObj.shapeName,colorObj]
			}
		}
		else{
			layers[layerId] = {[key]:[colorObj.shapeName,colorObj],layerName:colorObj.layerName}
		}
	})
	
	if(parsed.assets.length != 0){
		parsed.assets.forEach((asset,i) => {
			if('layers' in asset){
				extractColors(asset.layers,'assets',i).forEach((colorObj,i) =>{
					let color = colorObj.keyFramed ? colorObj.color[colorObj.color.length - 1].start.join()+colorObj.color[colorObj.color.length - 1].end.join(): colorObj.color.join()
					let rootItemName = colorObj.itemName.split('->')[0].trim()
					let key = generateNewKeyHash(rootItemName+':'+color)
					let layerId = colorObj.layerId.toString()
		
					if(layers.hasOwnProperty(layerId)){
						if( key in layers[layerId]){
							layers[layerId][key].push(colorObj)
						}
						else{
							layers[layerId][key] = [colorObj.shapeName,colorObj]
						}
						
					}
					else{
						
						layers[layerId] = {[key]:[colorObj.shapeName,colorObj],layerName:colorObj.layerName}
					}
				})
			}
		})
	}
	return layers
}
const setGradientKValue = (k,new_color,startIndex) => {
	let i = startIndex*4
	let j = 0
	let count = 3 
	
	while(count > 0){
		k[i] = new_color[j]
		i++
		j++
		count--
	}	
}
const getLastkeyFramedColor = (k,type) => {
	let colors = []
	k.forEach((obj,i)=>{
		const end = 'e' in obj ? obj.e: [255,255,255,0] //<----missing end color placeholder
		colors.push({time:obj.t,start:obj.s,end:end,index:i})
	})
	//s:start,e:end
	const s = colors[colors.length - 1].start
	const e = colors[colors.length - 1].end

	return  type =="solid"? toRGBADecimal(s) + toRGBADecimal(e):toRGBADecimalGradient(s)+toRGBADecimalGradient(e)
	
}

const traverseItemsAndSetKeyedSolid = (json,colorProps,color_path_len) => {
	let i = colorProps.colorPath[color_path_len-1]
	if(color_path_len  > 0){
		traverseItemsAndSetKeyedSolid(json.it[i],colorProps,color_path_len-1)
	}
	else{
		if(colorProps.colorType == 'start'){
			let k = json.c.k[colorProps.oldColorIndex]
			if('s' in k) k.s = colorProps.newColor
		}
		else if(colorProps.colorType == 'end'){
			let k = json.c.k[colorProps.oldColorIndex]
			if('e' in k) k.e = colorProps.newColor
		}
		let toBeHashed = getLastkeyFramedColor(json.c.k,'solid')
		newShapeGroupKeyHash =  generateNewKeyHash(colorProps.rootItemName+':'+toBeHashed)
	}
}

const traverseItemsAndSetKeyedGradient = (json,colorProps,color_path_len) => {
	let i = colorProps.colorPath[color_path_len-1]
	if(color_path_len  > 0){
		traverseItemsAndSetKeyedGradient(json.it[i],colorProps,color_path_len-1)
	}
	else{
		if(colorProps.colorType == 'start') setGradientKValue(json.g.k.k[colorProps.oldColorIndex].s,colorProps.newColor,colorProps.gradientStartIndex)
		else if(colorProps.colorType == 'end') setGradientKValue(json.g.k.k[colorProps.oldColorIndex].e,colorProps.newColor,colorProps.gradientStartIndex)
		let toBeHashed = getLastkeyFramedColor(json.g.k.k,'gradient')
		newShapeGroupKeyHash =  generateNewKeyHash(colorProps.rootItemName+':'+toBeHashed)
	}
}

const traverseItemsAndSetGradient = (json,colorProps,color_path_len) => {
	let i = colorProps.colorPath[color_path_len-1]
	if(color_path_len  > 0){
		traverseItemsAndSetGradient(json.it[i],colorProps,color_path_len-1)
	}
	else{
		setGradientKValue(json.g.k.k,colorProps.newColor,colorProps.gradientStartIndex)
		newShapeGroupKeyHash = generateNewKeyHash(colorProps.rootItemName+':'+toRGBADecimalGradient(json.g.k.k))
	}
}

const traverseItemsAndSetSolid = (json,colorProps,color_path_len) => {
	let i = colorProps.colorPath[color_path_len-1]
	if(color_path_len  > 0){
		traverseItemsAndSetSolid(json.it[i],colorProps,color_path_len-1)
	}
	else{
		json.c.k = colorProps.newColor
		newShapeGroupKeyHash = generateNewKeyHash(colorProps.rootItemName+':'+toRGBADecimal(json.c.k))

	}
}



const assignNewGradientColor = (json,colorProps) => {
	colorProps.newColor = colorProps.pickedColor.map((v,i)=> i!=3? parseInt(v)*1.0/255:v)
	colorProps.items.forEach((v,i) => {
		if(i != 0){
			const {itemName,itemPath,shapeId,layerId} = v
			const pathAndId = layerId.split(':')

			colorProps.rootItemName = itemName.split('->')[0].trim()
			colorProps.colorPath = v.itemPath

			let x = pathAndId[0] == "main" ? json.layers[pathAndId[1]].shapes[shapeId]: json.assets[pathAndId[2]].layers[pathAndId[1]].shapes[shapeId]
				if(colorProps.type == "keyed"){
					traverseItemsAndSetKeyedGradient(
						x,
						colorProps,
						itemPath.length
					)
				}
				else{
					traverseItemsAndSetGradient(
						x,
						colorProps,
						itemPath.length
					)
				}

			}
			
		
	})

	const parsed = parseColors(json,true)
	return {animation:json,colors:parsed,key:newShapeGroupKeyHash}

	
}

const assignNewSolidColor = (json,colorProps) => {
	colorProps.newColor = colorProps.pickedColor.map((v,i)=> i!=3? parseInt(v)*1.0/255:v)
	colorProps.items.forEach((v,i) => {
		if(i != 0){
			const {itemName,itemPath,shapeId,layerId} = v
			const pathAndId = layerId.split(':')

			colorProps.rootItemName = itemName.split('->')[0].trim()
			colorProps.colorPath = v.itemPath

			let x = pathAndId[0] == "main" ? json.layers[pathAndId[1]].shapes[shapeId]: json.assets[pathAndId[2]].layers[pathAndId[1]].shapes[shapeId]
				if(colorProps.type == "keyed"){
					traverseItemsAndSetKeyedSolid(
						x,
						colorProps,
						itemPath.length
					)
				}
				else{
					traverseItemsAndSetSolid(
						x,
						colorProps,
						itemPath.length
					)
				}

			}
	})

	const parsed = parseColors(json,true)
	return {animation:json,colors:parsed,key:newShapeGroupKeyHash}

	
}



export {
	parseColors,
	assignNewSolidColor,
	assignNewGradientColor
}
