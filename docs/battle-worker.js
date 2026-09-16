import {simulateChunks} from './core.js';
let simulation;
self.onmessage=({data})=>{
  try{
    if(data.type!=='continue')simulation=simulateChunks(data);
    const next=simulation?.next();if(next&&!next.done)self.postMessage(next.value);
  }catch(error){self.postMessage({error:error.message});}
};
