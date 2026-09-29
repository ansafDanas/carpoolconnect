import mongoose from "mongoose";
import validator from "validator";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: 2,
      maxlength: 50,
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      validate: [validator.isEmail, "Please provide a valid email"],
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
      select: false,
    },

    roles: {
      type: [
        {
          type: String,
          enum: ["passenger", "driver", "admin"],
        },
      ],
      default: ["passenger"],
    },

    // Legacy input/storage compatibility; roles is canonical.
    role: {
      type: String,
      enum: ["rider", "driver"],
      select: false,
    },

    phone: {
      type: String,
      default: "",
    },

    profileImage: {
      type: String,
      default: "",
    },

    vehicleInfo: {
      make: String,
      model: String,
      color: String,
      plateNumber: String,
      image: String,
      // Fuel economy, used to work out the honest cost of a shared trip.
      mileageKmpl: {
        type: Number,
        min: 1,
        max: 100,
        default: 15,
      },
    },

    // Safety and matching preferences.
    isVerified: {
      type: Boolean,
      default: false,
    },

    bio: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },

    conversationStarter: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },

    vibeTags: {
      type: [String],
      default: [],
    },

    languages: {
      type: [String],
      default: [],
    },

    // Riders can ask to travel only with other women.
    womenOnly: {
      type: Boolean,
      default: false,
    },

    // Needed to honour a women-only preference in either direction.
    gender: {
      type: String,
      enum: ["female", "male", "nonbinary", "undisclosed"],
      default: "undisclosed",
    },

    blockedUsers: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },

    // Set by an admin when a safety report is upheld. A suspended account
    // cannot log in or use the platform until it is reinstated.
    isSuspended: {
      type: Boolean,
      default: false,
    },

    suspendedReason: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },

    suspendedAt: Date,

    rating: {
      type: Number,
      default: 5,
    },
    ratingCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre("validate", async function () {
  const normalizedRoles = this.role
    ? [this.role === "rider" ? "passenger" : this.role]
    : Array.isArray(this.roles)
      ? this.roles.map((role) => (role === "rider" ? "passenger" : role))
      : [];

  this.roles = [...new Set(normalizedRoles)].filter((role) =>
    ["passenger", "driver", "admin"].includes(role)
  );

  if (!this.roles.length) {
    this.roles = ["passenger"];
  }

  this.role = undefined;
});

userSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return;
  }

  const salt = await bcrypt.genSalt(10);

  this.password = await bcrypt.hash(this.password, salt);
});
userSchema.methods.matchPassword =
  async function (enteredPassword) {
    return await bcrypt.compare(
      enteredPassword,
      this.password
    );
  };

const User = mongoose.model("User", userSchema);

export default User;