require('dotenv').config();
const mongoose=require('mongoose');
(async()=>{
  await mongoose.connect(process.env.MONGODB_URI);
  const col=mongoose.connection.collection('gangs');
  const gangs=await col.find({tag: {$exists:false}}).toArray();
  console.log(`Gangs sin tag: ${gangs.length}`);
  for(const g of gangs){
    const tag = String(g.nombre||'TAG').replace(/[^A-Za-z0-9]/g,'').substring(0,5).toUpperCase() || 'TAG';
    console.log(` - ${g.nombre} -> ${tag}`);
    await col.updateOne({_id:g._id}, {$set:{tag}});
  }
  const nullTags=await col.find({tag: null}).toArray();
  for(const g of nullTags){
    const tag = String(g.nombre||'TAG').replace(/[^A-Za-z0-9]/g,'').substring(0,5).toUpperCase() || 'TAG';
    console.log(` - (null) ${g.nombre} -> ${tag}`);
    await col.updateOne({_id:g._id}, {$set:{tag}});
  }
  console.log('done');
  await mongoose.disconnect();
})()
