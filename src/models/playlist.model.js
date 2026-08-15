import mongoose,{Schema} from "mongoose";

const playlistSchema = new Schema(
    {
        name:{
            type:String,
            required:true
        },
        description:{
            type:String,
        },
        video:[
            {
                type:Schema.Types.ObjectId,
                ref:"Video"
            }
        ],
        owner:{
            type:Schema.Types.ObjectId,
            ref:"User"
        }
    },
    {
        timestamps:true
    }
)

playlistSchema.index({ owner: 1, createdAt: -1 });

export const Playlist = mongoose.model("Playlist",playlistSchema)