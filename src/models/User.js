import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    password: { type: String, required: true, select: false },
  },
  { timestamps: true },
);

userSchema.set("toJSON", {
  transform(_document, result) {
    delete result.password;
    delete result.__v;
    return result;
  },
});

export const User = mongoose.model("User", userSchema);
