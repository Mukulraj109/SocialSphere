import mongoose, {Schema} from "mongoose";

const likeSchema = Schema(
    {
        video:{
            type:Schema.Types.ObjectId,
            ref:"Video"
        },
        comment:{
            type:Schema.Types.ObjectId,
            ref:"Comment"
        },
        community:{
            type:Schema.Types.ObjectId,
            ref:"Community"
        },
        likedBy:{
            type:Schema.Types.ObjectId,
            ref:"User"
        }
    },
    {
        timestamps:true
    }
)

likeSchema.index({ likedBy: 1, video: 1 }, { unique: true, partialFilterExpression: { video: { $type: "objectId" } } });
likeSchema.index({ likedBy: 1, comment: 1 }, { unique: true, partialFilterExpression: { comment: { $type: "objectId" } } });
likeSchema.index({ likedBy: 1, community: 1 }, { unique: true, partialFilterExpression: { community: { $type: "objectId" } } });

export const Like = mongoose.model("Like",likeSchema);