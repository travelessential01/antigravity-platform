import { Inngest } from "inngest";

const inngest = new Inngest({ id: "antigravity-clinical-engine", eventKey: "local" });

async function run() {
  console.log("Starting Load Simulation for PagerDuty Alerting (Queue Depth > 100)...");

  const events = [];
  for (let i = 0; i < 150; i++) {
    events.push({
      name: "complaint/submitted",
      data: {
        complaintId: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
        patientId: `11111111-1111-1111-1111-${String(i).padStart(12, '0')}`,
        clinicalSlaMinutes: 10
      }
    });
  }

  // Send all at once to spike the queue
  await inngest.send(events);

  console.log(`✅ Successfully injected 150 'complaint/submitted' events into Inngest.`);
  console.log(`Open SigNoz Custom Metrics Dashboard to observe 'inngest.queue.depth' spiking `);
  console.log(`and triggering the PagerDuty Warning Alert.`);
}

run().catch(console.error);
