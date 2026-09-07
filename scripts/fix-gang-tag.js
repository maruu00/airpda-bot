require('dotenv').config();
const mongoose=require('mongoose');
(async()=>{
  await mongoose.connect(process.env.MONGODB_URI);
  const col=mongoose.connection.collection('gangs');
  const g=await col.findOne({nombre:'Los Black Cat'});
  console.log('before tag:', g.tag);
  const tag = g.nombre.replace(/[^A-Za-z]/g,'').substring(0,5).toUpperCase() || 'BCAT';
  console.log('generated tag:', tag);
  await col.updateOne({_id:g._id}, {$set:{tag: tag}});
  console.log('updated');
  const g2=await col.findOne({_id:g._id});
  console.log('after tag:', g2.tag);
  await mongoose.disconnect();
})()
