import test from "node:test";
import assert from "node:assert/strict";
import { detectLanguageOfText, detectLanguageOfResume } from "../../src/utils/language-detector.js";

test("detectLanguageOfText: returns 'vi' if text contains Vietnamese accented characters", () => {
  const text = "Xin chào, đây là một CV kiểm tra.";
  assert.equal(detectLanguageOfText(text), "vi");
});

test("detectLanguageOfText: returns fallback ('en') if text is English or has no Vietnamese accents", () => {
  const text = "Hello, this is a test resume document.";
  assert.equal(detectLanguageOfText(text), "en");
});

test("detectLanguageOfText: returns fallback ('en') if text is empty or invalid", () => {
  assert.equal(detectLanguageOfText(null), "en");
  assert.equal(detectLanguageOfText(""), "en");
});

test("detectLanguageOfResume: returns 'vi' if any fields in CV JSON contain Vietnamese diacritics", () => {
  const resume = {
    personalInfo: { name: "Nguyen Van A" },
    summary: "Kinh nghiệm 5 năm làm kỹ sư phần mềm.",
    workExperience: [
      { company: "Công ty Công nghệ", role: "Developer", description: "Lập trình hệ thống backend." }
    ]
  };
  assert.equal(detectLanguageOfResume(resume), "vi");
});

test("detectLanguageOfResume: returns fallback ('en') if all fields are in English", () => {
  const resume = {
    personalInfo: { name: "John Doe" },
    summary: "Experienced software engineer with 5 years in backend development.",
    workExperience: [
      { company: "Tech Corp", role: "Developer", description: "Developed scalable backend systems." }
    ]
  };
  assert.equal(detectLanguageOfResume(resume), "en");
});
