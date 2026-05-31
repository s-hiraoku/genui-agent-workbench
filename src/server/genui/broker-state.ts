import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { getGenUIRoot } from "./artifacts";

export type BrokerState = {
  controlUrl: string;
  nextUrl: string;
  pid: number;
  brokerProtocolVersion: string;
  appVersion: string;
  controlToken?: string;
  updatedAt: string;
};

const BROKER_STATE_FILE = "broker.json";

export function getBrokerStatePath(): string {
  return path.join(getGenUIRoot(), BROKER_STATE_FILE);
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function getBrokerStateReadPaths(): string[] {
  const home = os.homedir();
  return unique([
    getBrokerStatePath(),
    home
      ? path.join(home, "Library", "Application Support", "GenUI Popup Broker", "genui-data", BROKER_STATE_FILE)
      : "",
    home
      ? path.join(home, "Library", "Application Support", "genui-agent-workbench", "genui-data", BROKER_STATE_FILE)
      : "",
  ]);
}

async function readBrokerStateFile(statePath: string): Promise<(BrokerState & { stateMtimeMs: number }) | null> {
  try {
    const stat = await fs.stat(statePath);
    return {
      ...(JSON.parse(await fs.readFile(statePath, "utf8")) as BrokerState),
      stateMtimeMs: stat.mtimeMs,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export async function writeBrokerState(state: BrokerState): Promise<void> {
  await fs.mkdir(getGenUIRoot(), { recursive: true });
  await fs.writeFile(getBrokerStatePath(), JSON.stringify(state, null, 2), "utf8");
}

export async function readBrokerState(): Promise<BrokerState | null> {
  if (process.env.GENUI_BROKER_STATE_FILE) {
    const explicitState = await readBrokerStateFile(process.env.GENUI_BROKER_STATE_FILE);
    if (explicitState) {
      const state = { ...explicitState };
      delete (state as Partial<typeof state>).stateMtimeMs;
      return state;
    }
  }

  const states: Array<BrokerState & { stateMtimeMs: number }> = [];

  for (const statePath of getBrokerStateReadPaths()) {
    const state = await readBrokerStateFile(statePath);
    if (state) {
      states.push(state);
    }
  }

  states.sort((a, b) => b.stateMtimeMs - a.stateMtimeMs);
  const [latest] = states;
  if (!latest) return null;
  const state = { ...latest };
  delete (state as Partial<typeof state>).stateMtimeMs;
  return state;
}
