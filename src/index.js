import React from 'react'
import ReactDOM from 'react-dom';
import LottieEditor from './App';
import * as serviceWorker from './serviceWorker';
import { Provider } from 'mobx-react';
import Store from './store'

ReactDOM.render(<Provider Store={Store}><LottieEditor /></Provider>, document.getElementById('root'));

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();