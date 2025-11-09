
// * Dependencies Required

import net from "net";

// * Exported Module

class TOR_Network_Controller {

    private static CONTROL_PORT = Number(process.env.CONTROL_PORT as string);
    private static  CONTROL_PASSWORD = process.env.CONTROL_PASSWORD as string;

    public static async rotateTorIP() {
        return new Promise<void>((resolve, reject) => {
            const socket = net.connect(this.CONTROL_PORT, "127.0.0.1", () => {
                socket.write(`AUTHENTICATE "${this.CONTROL_PASSWORD}"\r\n`);
                socket.write("SIGNAL NEWNYM\r\n");
                socket.write("QUIT\r\n");
                socket.end();
                resolve();
            });
            socket.on("error", reject);
        });
    }

}

export default TOR_Network_Controller