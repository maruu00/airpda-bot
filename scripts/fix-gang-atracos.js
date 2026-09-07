require('dotenv').config();
const mongoose=require('mongoose');
(async()=>{
  await mongoose.connect(process.env.MONGODB_URI);
  const Gang=require('./../database/models/Gang');
  const Player=require('./../database/models/Player');
  const gang=await Gang.findOne({nombre:'Los Black Cat'});
  if(!gang){ console.log('no gang'); process.exit(1); }
  console.log(`Antes: nivel ${gang.nivel} atracos ${gang.atracos} tag ${gang.tag}`);
  // Incrementar 1 por el Badulaque que no contó
  gang.atracos = (gang.atracos||0)+1;
  console.log('Incrementando a', gang.atracos);
  // Buscar quién hizo último atraco (últimoAtracoFecha más reciente entre miembros)
  const members = gang.miembros.map(m=>m.discordId);
  const players = await Player.find({discordId: {$in: members}}).lean();
  console.log('players:', players.map(p=>({id:p.discordId, robos:p.robosRealizados, ultimo:p.ultimoAtracoFecha})));
  // Elegir el que tenga ultimoAtracoFecha más reciente
  let targetId = null;
  let latest = null;
  for(const p of players){
    if(p.ultimoAtracoFecha){
      const t = new Date(p.ultimoAtracoFecha);
      if(!latest || t > latest){ latest=t; targetId=p.discordId; }
    }
  }
  if(targetId){
    const mem = gang.miembros.find(m=>m.discordId===targetId);
    if(mem){ mem.contribucion=(mem.contribucion||0)+1; console.log(`contribucion +1 para ${targetId} ahora ${mem.contribucion}`); }
  } else {
    console.log('no target, bump lider');
    const liderMem = gang.miembros.find(m=>m.discordId===gang.lider);
    if(liderMem) liderMem.contribucion=(liderMem.contribucion||0)+1;
  }
  await gang.save({validateBeforeSave:false});
  console.log(`Despues: nivel ${gang.nivel} atracos ${gang.atracos} tag ${gang.tag}`);
  console.log('Hecho. Ahora debería salir 1/10');
  await mongoose.disconnect();
})()
