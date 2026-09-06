import { ERPEventBus } from "../../../server-erp-core.js";

export function initCostEvents() {
  const eventBus = ERPEventBus.getInstance();
  eventBus.on("CostRecorded", (data: any) => {
    console.log(`[Costs Event] New operational cost recorded: ${data.category} - ${data.amount} EGP.`);
  });
}
