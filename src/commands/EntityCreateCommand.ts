import * as fs from "fs";
import {ConnectionOptions} from "../connection/ConnectionOptions";

/**
 * Generates a new entity.
 */
export class EntityCreateCommand {
    command = "entity:create";
    describe = "Generates a new entity.";

    builder(yargs: any) {
        return yargs
            .option("c", {
                alias: "connection",
                default: "default",
                describe: "Name of the connection on which to run a query"
            })
            .option("n", {
                alias: "name",
                describe: "Name of the entity class.",
                demand: true
            })
            .option("d", {
                alias: "dir",
                describe: "Directory where entity should be created."
            })
            .option("cf", {
                alias: "config",
                default: "ormconfig.json",
                describe: "Name of the file with connection configuration."
            });
    }

    async handler(argv: any) {
        const fileContent = EntityCreateCommand.getTemplate(argv.name);
        const filename = argv.name + ".ts";
        let directory = argv.dir;

        // if directory is not set then try to open tsconfig and find default path there
        if (!directory) {
            try {
                const connections: ConnectionOptions[] = require(process.cwd() + "/" + argv.config);
                if (connections) {
                    const connection = connections.find(connection => { // todo: need to implement "environment" support in the ormconfig too
                        return connection.name === argv.connection || ((argv.connection === "default" || !argv.connection) && !connection.name);
                    });
                    if (connection && connection.cli) {
                        directory = connection.cli.entitiesDir;
                    }
                }
            } catch (err) { }
        }

        await EntityCreateCommand.createFile(process.cwd() + "/" + (directory ? (directory + "/") : "") + filename, fileContent);
    }

    // -------------------------------------------------------------------------
    // Protected Static Methods
    // -------------------------------------------------------------------------

    /**
     * Creates a file with the given content in the given path.
     */
    protected static createFile(path: string, content: string): Promise<void> {
        return new Promise<void>((ok, fail) => {
            fs.writeFile(path, content, err => err ? fail(err) : ok());
        });
    }

    /**
     * Gets contents of the entity file.
     */
    protected static getTemplate(name: string): string {
        return `import {Table} from "typeorm";

@Table()
export class ${name} {

}
`;
    }

}