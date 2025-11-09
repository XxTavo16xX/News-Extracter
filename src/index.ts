
// * Dependencies Required

import dotenv from "dotenv";

// * Initializing DotEnv

dotenv.config({ path: ".env" });

// * Modules Required

import News_Extracter from "./New-Extracter";
// import Dictionary_Contructor from "./Dictionary";

(async () => {

    try {

        await News_Extracter.init();

    } catch (e) {

        console.error("Fatal error starting News_Extracter:", e);
        process.exit(1);

    }
    
})();

// Dictionary_Contructor.init();