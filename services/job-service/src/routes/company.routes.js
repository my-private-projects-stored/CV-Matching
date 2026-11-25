import express from "express";
import multer from "multer";
import { ROLES } from "@cvm/shared";
import { requireAuth, requireRole } from "../middleware/auth-context.js";

const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

export function createCompanyRoutes(companyService) {
  const router = express.Router();

  router.get("/", async (req, res, next) => {
    try {
      const companies = await companyService.listCompanies({
        verificationStatus: req.query?.verificationStatus || null,
      });
      res.json({ companies });
    } catch (error) {
      next(error);
    }
  });

  router.get("/me", requireAuth, requireRole(ROLES.RECRUITER, ROLES.TECH_STAFF), async (req, res, next) => {
    try {
      const company = await companyService.getMyCompany({ ownerId: req.auth.id });
      res.json({ company });
    } catch (error) {
      next(error);
    }
  });

  router.put("/me", requireAuth, requireRole(ROLES.RECRUITER, ROLES.TECH_STAFF), async (req, res, next) => {
    try {
      const company = await companyService.upsertMyCompany({
        ownerId: req.auth.id,
        payload: req.body || {},
      });
      res.json({ company });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/me/logo",
    requireAuth,
    requireRole(ROLES.RECRUITER, ROLES.TECH_STAFF),
    logoUpload.single("file"),
    async (req, res, next) => {
      try {
        const result = await companyService.uploadCompanyLogo({
          ownerId: req.auth.id,
          file: req.file,
        });
        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  router.patch("/:id/verify", requireAuth, requireRole(ROLES.TECH_STAFF), async (req, res, next) => {
    try {
      const company = await companyService.verifyCompany({
        companyId: req.params.id,
        actorId: req.auth.id,
        status: req.body?.status,
        note: req.body?.note,
      });
      res.json({ company });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id", async (req, res, next) => {
    try {
      const company = await companyService.getCompanyById({ companyId: req.params.id });
      res.json({ company });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
