import mongoose, {Schema} from "mongoose";

const communitySchema = Schema(
    {
        content:{
            type:String,
            required:true
        },
        owner:{
            type: Schema.Types.ObjectId,
            ref:"User"
        }
    },
    {
        timestamps:true
    }
)

communitySchema.index({ createdAt: -1 });
communitySchema.index({ owner: 1, createdAt: -1 });

export const Community = mongoose.model("Community",communitySchema)