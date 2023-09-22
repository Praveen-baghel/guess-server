const mongoose=require("mongoose");
 const playerSchema=new mongoose.Schema({
    nickName:{
        type: String,
        trim: true
    },
    socketID:{
        type: String
    },
    isPartyLeader:{
        type: Boolean,
        default: false
    },
    points:{
        type:Number,
        default: 0
    }
 });
 const player1=mongoose.model('Player',playerSchema);
 module.exports={
    player1,
    playerSchema
 };