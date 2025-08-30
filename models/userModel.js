import mongoose from "mongoose";
import crypto from "crypto";
import mongooseLeanVirtuals from "mongoose-lean-virtuals";
import slugify from "slugify";

const { Schema, model } = mongoose;

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    biography: {
      type: String,
      validate: {
        validator: function (v) {
          // Allow an empty string (for clearing the biography)
          if (v === "") return true;
          // Otherwise, if a value is provided, ensure it meets the length requirements
          if (typeof v !== "string") return false;
          const trimmed = v.trim();
          return trimmed.length >= 20 && trimmed.length <= 500;
        },
        message: "Biography must be between 20-500 characters",
      },
    },
    headline: {
      type: String,
      default: "",
      maxlength: [60, "eadline cannot exceed 60 characters"],
      trim: true,
      required: false,
    },

    socialMedia: {
      github: {
        type: String,
        trim: true,
        default: "",
        validate: {
          validator: (username) => {
            if (username == "") return true;
            return /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(username);
          },
          message:
            "Please provide a valid GitHub username (1-39 characters, alphanumeric and hyphens)",
        },
      },
      linkedin: {
        type: String,
        trim: true,
        default: "",
        validate: {
          validator: (username) => {
            if (username == "") return true;
            return /^[a-z0-9-]{3,100}$/i.test(username);
          },
          message:
            "Please provide a valid LinkedIn username (3-100 characters, alphanumeric and hyphens)",
        },
      },
      facebook: {
        type: String,
        trim: true,
        default: "",
        validate: {
          validator: (username) => {
            if (username == "") return true;
            return /^[a-z0-9.]{5,50}$/i.test(username);
          },
          message:
            "Please provide a valid Facebook username (5-50 characters, alphanumeric and dots)",
        },
      },
      instagram: {
        type: String,
        trim: true,
        default: "",
        validate: {
          validator: (username) => {
            if (username == "") return true;
            return /^[a-zA-Z0-9._]{1,30}$/.test(username);
          },
          message:
            "Please provide a valid Instagram username (1-30 characters)",
        },
      },
    },
    instructorRating: {
      type: Object,
      default: {
        averageRatings: 0,
        totalRatings: 0,
      },
    },
    password: {
      type: String,
      required: true,
      select: false,
    },

    role: {
      type: String,
      enum: ["student", "teacher", "admin"],
      default: "student",
    },
    enrolledCourses: [
      {
        type: Schema.Types.ObjectId,
        ref: "Course",
      },
    ],
    createdCourses: [
      {
        type: Schema.Types.ObjectId,
        ref: "Course",
      },
    ],
    completedCourses: [
      {
        type: Schema.Types.ObjectId,
        ref: "Course",
      },
    ],
    certificates: [
      {
        course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
        issuedAt: { type: Date, default: Date.now },
        certificateUrl: {
          type: Object,
          default: {
            public_id: null,
            url: null,
          },
          required: [true, "Certificate URL is required"],
        },
      },
    ],
    profilePicture: {
      type: Object,
      default: {
        public_id: null,
        url: null,
      },
    },
    slug: {
      type: String,
      unique: true,
      index: true,
    },
    passwordResetToken: String,
    passwordResetExpires: Date,
    passwordChangedAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ "certificates.course": 1 });
userSchema.index({ role: 1 });

// Virtuals
userSchema.virtual("socialLinks").get(function () {
  const { github, linkedin, youtube, facebook, instagram } = this.socialMedia;
  return {
    github: github ? `https://github.com/${github}` : null,
    linkedin: linkedin ? `https://linkedin.com/in/${linkedin}` : null,
    // twitter: twitter ? `https://twitter.com/${twitter}` : null,
    youtube: youtube ? `https://youtube.com/${youtube}` : null,
    facebook: facebook ? `https://facebook.com/${facebook}` : null,
    instagram: instagram ? `https://instagram.com/${instagram}` : null,
  };
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("username")) return next();

  this.slug = slugify(this.username, {
    lower: true,
    strict: true,
    remove: /[*+~.()'"!:@]/g,
  });
  next();
});

userSchema.methods.changePasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

userSchema.methods.createResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");
  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

userSchema.plugin(mongooseLeanVirtuals);

const User = mongoose.models.User || model("User", userSchema);

export default User;
