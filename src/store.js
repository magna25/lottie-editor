
import {observable,decorate,action,configure} from 'mobx'

configure({ enforceActions: "observed" }) //

class Store {
    json = {}
    setJson = (val) => {this.json = val}
}

decorate(Store,{
    json:observable,
    setJson:action,
    
})

export default new Store()