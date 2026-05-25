import { isIP } from "node:net";

const DEFAULT_CLIENT_PORT = "6274";

export type OriginValidationOptions = {
  origin?: string | string[];
  requestHost?: string | string[];
  clientPort?: string;
  allowedOriginsEnv?: string;
};

const firstHeaderValue = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value;

const parseAllowedOrigins = (allowedOriginsEnv: string) =>
  allowedOriginsEnv
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const defaultAllowedOrigins = (clientPort: string) => [
  `http://localhost:${clientPort}`,
  `http://127.0.0.1:${clientPort}`,
  `http://[::1]:${clientPort}`,
];

const getHostname = (host: string) => {
  try {
    return new URL(`http://${host}`).hostname;
  } catch {
    return undefined;
  }
};

const normalizeHostname = (hostname: string | undefined) => {
  if (!hostname) {
    return undefined;
  }

  return hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
};

const isIpHostname = (hostname: string | undefined) =>
  isIP(normalizeHostname(hostname) ?? "") !== 0;

const isSameHostClientOrigin = (
  origin: string,
  requestHost: string | undefined,
  clientPort: string,
) => {
  if (!requestHost) {
    return false;
  }

  try {
    const originUrl = new URL(origin);
    const requestHostname = getHostname(requestHost);
    const originHostname = originUrl.hostname;

    return (
      originUrl.protocol === "http:" &&
      isIpHostname(originHostname) &&
      normalizeHostname(originHostname) ===
        normalizeHostname(requestHostname) &&
      originUrl.port === clientPort
    );
  } catch {
    return false;
  }
};

export const isAllowedOrigin = ({
  origin,
  requestHost,
  clientPort = DEFAULT_CLIENT_PORT,
  allowedOriginsEnv,
}: OriginValidationOptions) => {
  const originValue = firstHeaderValue(origin);
  if (!originValue) {
    return true;
  }

  if (allowedOriginsEnv !== undefined) {
    return parseAllowedOrigins(allowedOriginsEnv).includes(originValue);
  }

  if (defaultAllowedOrigins(clientPort).includes(originValue)) {
    return true;
  }

  return isSameHostClientOrigin(
    originValue,
    firstHeaderValue(requestHost),
    clientPort,
  );
};
