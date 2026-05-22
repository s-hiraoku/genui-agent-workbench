import { promises as fs } from "node:fs";
import path from "node:path";
import { getGenUIRoot } from "./artifacts";

export type BrokerState = {
  controlUrl: string;
  nextUrl: string;
  pid: number;
  brokerProtocolVersion: string;
  appVersion: string;
  updatedAt: string;
};

const BROKER_STATE_FILE = "broker.json";

export function getBrokerStatePath(): string {
  return path.join(getGenUIRoot(), BROKER_STATE_FILE);
}

export async function writeBrokerState(state: BrokerState): Promise<void> {
  await fs.mkdir(getGenUIRoot(), { recursive: true });
  await fs.writeFile(getBrokerStatePath(), JSON.stringify(state, null, 2), "utf8");
}

export async function readBrokerState(): Promise<BrokerState | null> {
  try {
    return JSON.parse(await fs.readFile(getBrokerStatePath(), "utf8")) as BrokerState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}
