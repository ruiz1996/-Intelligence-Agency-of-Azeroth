import {simulate} from './core.js';
self.onmessage=({data})=>{try{self.postMessage(simulate(data));}catch(error){self.postMessage({error:error.message});}};
