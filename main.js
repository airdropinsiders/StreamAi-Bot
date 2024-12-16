import { generateDeviceId, loadProxies, loadFile } from './utils/scripts.js';
import { Gateway } from './utils/gateway.js';
import log from './utils/logger.js';
import banner from './utils/banner.js';

const PROXIES_FILE = 'proxies.txt'
const USERS_FILE = 'userIds.txt'
const SERVER = "gw0.streamapp365.com";
const MAX_GATEWAYS = 32;

async function setupGatewaysForUser(user) {
    const proxies = loadProxies(PROXIES_FILE);
    const numberGateway = proxies.length > MAX_GATEWAYS ? MAX_GATEWAYS : proxies.length;
    const userGateways = [];
    for (let i = 0; i < numberGateway; i++) {
        const proxy = proxies[i % proxies.length];
        try {
            const deviceId = generateDeviceId();
            log.info(`Connecting to Gateway ${i + 1} for User ${user} using Device ID: ${deviceId} via Proxy: ${proxy}`);

            const gateway = new Gateway(SERVER, user, deviceId, proxy);
            userGateways.push(gateway);

            await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (err) {
            log.error(`Failed to connect Gateway ${i + 1} for User ${user}: ${err.message}`);
        }
    }
    return userGateways;
}

async function main() {
    log.info(banner);
    const USERS = loadFile(USERS_FILE)
    try {
        log.info("Setting up gateways for all users...");

        const results = await Promise.allSettled(
            USERS.map((user) => setupGatewaysForUser(user))
        );

        results.forEach((result, index) => {
            if (result.status === "fulfilled") {
                log.info(`User ${USERS[index]}: Successfully set up ${result.value.length} gateways.`);
            } else {
                log.error(`User ${USERS[index]}: Failed to set up gateways. Reason: ${result.reason}`);
            }
        });

        log.info("All user gateway setups attempted.");

        process.on('SIGINT', () => {
            log.info("Cleaning up gateways...");
            results
                .filter(result => result.status === "fulfilled")
                .flatMap(result => result.value)
                .forEach((gateway, index) => {
                    if (gateway.ws) {
                        log.info(`Closing Gateway ${index + 1}`);
                        gateway.ws.close();
                    }
                });
            process.exit();
        });

    } catch (error) {
        log.error("Unexpected error during gateway setup:", error);
    }
}

// Run
main().catch((error) => log.error("Unexpected error:", error));
