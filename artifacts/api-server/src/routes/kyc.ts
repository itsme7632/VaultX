import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, kycSubmissionsTable, usersTable, notificationsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/kyc/status", requireAuth, async (req, res): Promise<void> => {
  const [submission] = await db
    .select()
    .from(kycSubmissionsTable)
    .where(eq(kycSubmissionsTable.userId, req.session.userId!))
    .orderBy(desc(kycSubmissionsTable.submittedAt))
    .limit(1);

  if (!submission) {
    res.json({ status: "none" });
    return;
  }

  res.json({
    status: submission.status,
    rejectionReason: submission.rejectionReason,
    submittedAt: submission.submittedAt,
    reviewedAt: submission.reviewedAt,
    documentType: submission.documentType,
    fullLegalName: submission.fullLegalName,
    documentNumber: submission.documentNumber,
    country: submission.country,
    frontImageUrl: submission.frontImageUrl,
    backImageUrl: submission.backImageUrl,
    selfieUrl: submission.selfieUrl,
  });
});

router.post("/kyc/submit", requireAuth, async (req, res): Promise<void> => {
  const { documentType, fullLegalName, documentNumber, country, frontImageUrl, backImageUrl, selfieUrl } = req.body;

  if (!documentType || !frontImageUrl || !selfieUrl) {
    res.status(400).json({ error: "Missing fields", message: "Document type, front image, and selfie are required" });
    return;
  }

  const existing = await db
    .select()
    .from(kycSubmissionsTable)
    .where(eq(kycSubmissionsTable.userId, req.session.userId!))
    .orderBy(desc(kycSubmissionsTable.submittedAt))
    .limit(1);

  if (existing.length > 0 && existing[0].status === "pending") {
    res.status(400).json({ error: "Pending submission", message: "You already have a pending KYC submission" });
    return;
  }

  const [submission] = await db
    .insert(kycSubmissionsTable)
    .values({
      userId: req.session.userId!,
      documentType,
      fullLegalName: fullLegalName || "",
      documentNumber: documentNumber || "",
      country: country || "",
      frontImageUrl,
      backImageUrl: backImageUrl || null,
      selfieUrl,
      status: "pending",
    })
    .returning();

  await db
    .update(usersTable)
    .set({ kycStatus: "pending" })
    .where(eq(usersTable.id, req.session.userId!));

  await db.insert(notificationsTable).values({
    userId: req.session.userId!,
    type: "security",
    title: "KYC Submitted",
    message: "Your identity verification has been submitted and is under review. We'll notify you once reviewed.",
  });

  res.status(201).json({
    status: submission.status,
    submittedAt: submission.submittedAt,
    documentType: submission.documentType,
  });
});

export default router;
