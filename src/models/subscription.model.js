import mongoose from "mongoose";

const subscriptionSchema =new mongoose.Schema(
    {
        subscriber: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        channel:{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    },
    {
        timestamps: true
    }
)

subscriptionSchema.index({ subscriber: 1, channel: 1 }, { unique: true });
subscriptionSchema.index({ channel: 1, createdAt: -1 });

export const Subscription = mongoose.model("Subscription", subscriptionSchema);