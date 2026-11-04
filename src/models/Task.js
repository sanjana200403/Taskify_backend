import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, default: "", trim: true, maxlength: 2000 },
    scheduledAt: { type: Date, required: true, index: true },
    priority: { type: String, enum: ["Low", "Medium", "High"], default: "Medium" },
    status: { type: String, enum: ["Pending", "In Progress", "Completed"], default: "Pending" },
  },
  { timestamps: true },
);

taskSchema.index({ user: 1, scheduledAt: 1 });
taskSchema.index({ user: 1, status: 1, scheduledAt: 1 });
taskSchema.index({ user: 1, title: "text", description: "text" });

taskSchema.set("toJSON", {
  transform(_document, result) {
    delete result.__v;
    return result;
  },
});

export const Task = mongoose.model("Task", taskSchema);
