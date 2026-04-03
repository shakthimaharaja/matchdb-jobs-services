import { Router } from "express";
import { requirePermission } from "../middleware/rbac.middleware";
import {
  listClients,
  createClient,
  getClient,
  updateClient,
  getClientRateCards,
  createRateCard,
} from "../controllers/clients.controller";

const router = Router();

// ═══ QUICKBOOKS — CLIENT MANAGEMENT ═══

router.get("/", requirePermission("clients"), listClients);
router.post("/", requirePermission("clients"), createClient);
router.get("/:id", requirePermission("clients"), getClient);
router.put("/:id", requirePermission("clients"), updateClient);
router.get("/:id/rate-cards", requirePermission("clients"), getClientRateCards);
router.post("/:id/rate-cards", requirePermission("clients"), createRateCard);

export default router;
