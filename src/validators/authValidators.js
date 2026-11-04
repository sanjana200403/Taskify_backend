import { body } from "express-validator";

export const registerValidation = [
  body("name").trim().isLength({ min: 2, max: 80 }).withMessage("Name must be between 2 and 80 characters"),
  body("email").trim().isEmail().withMessage("Enter a valid email address").normalizeEmail(),
  body("password")
    .isString()
    .withMessage("Password is required")
    .bail()
    .isLength({ min: 8, max: 72 })
    .withMessage("Password must be between 8 and 72 characters")
    .matches(/[a-z]/)
    .withMessage("Password must contain a lowercase letter")
    .matches(/[A-Z]/)
    .withMessage("Password must contain an uppercase letter")
    .matches(/\d/)
    .withMessage("Password must contain a number")
    .matches(/[^A-Za-z0-9\s]/)
    .withMessage("Password must contain a special character")
    .custom((value) => !/\s/.test(value))
    .withMessage("Password must not contain spaces"),
];

export const loginValidation = [
  body("email").trim().isEmail().withMessage("Enter a valid email address").normalizeEmail(),
  body("password").isString().notEmpty().withMessage("Password is required"),
];
