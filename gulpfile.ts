import browserify = require("browserify");
import log = require("fancy-log");
import gulp = require("gulp");
import merge = require("merge-stream");
import minimist = require("minimist");
import { TempDirectory } from "temp-filesystem";
import Path = require("upath");
import buffer = require("vinyl-buffer");
import source = require("vinyl-source-stream");
import watchify = require("watchify");
import { Settings } from "./.gulp/Settings";
import "./.gulp/TaskFunction";

/**
 * The arguments passed by the user.
 */
let args = minimist(
    process.argv.slice(2),
    {
        string: [
            "mode"
        ],
        alias: {
            mode: "m"
        },
        default: {
            mode: "Debug"
        }
    });

/**
 * The settings for building the project.
 */
let settings = new Settings(args["mode"]);

/**
 * Builds the project in watched mode.
 */
export function Watch()
{
    settings.Watch = true;
    log.info("Starting compilation in watch mode...");
    Build();
}
Watch.description = "Builds the project in watched mode.";

/**
 * Builds the project.
 */
export function Build()
{
    let entries = [
        "extension.ts",
        "test/runTests.ts",
        "test/index.ts",
        "test/extension.test.ts"
    ];

    let watcher: browserify.BrowserifyObject;
    let bundlers: { [entry: string]: browserify.BrowserifyObject } = {};

    let optionBase: browserify.Options = {
        ...watchify.args,
        debug: settings.Debug,
        node: true,
        ignoreMissing: true
    };

    if (settings.Watch)
    {
        watcher = watchify(
            browserify(
                {
                    ...optionBase,
                    entries: entries.map(file => settings.SourcePath(file))
                }));

        watcher.on(
            "update",
            () =>
            {
                log.info("File change detected. Starting incremental compilation...");
                build();
            });
    }

    for (let file of entries)
    {
        let bundler = browserify(
            {
                ...optionBase,
                basedir: Path.normalize(settings.DestinationPath(Path.dirname(file))),
                entries: [
                    Path.normalize(settings.SourcePath(file))
                ],
                standalone: Path.join(Path.dirname(file), Path.parse(file).name)
            });

        bundlers[file] = bundler;
    }

    for (let bundler of entries.map((entry) => bundlers[entry]).concat(settings.Watch ? [watcher] : []))
    {
        bundler.plugin(
            require("tsify"),
            {
                project: settings.ExtensionPath("tsconfig.json")
            }
        ).external(
            [
                "mocha",
                "shelljs",
                "vscode"
            ]);
    }

    /**
     * Builds the project.
     */
    // tslint:disable-next-line: completed-docs
    function build()
    {
        let errorMessages: string[] = [];
        let streams: NodeJS.ReadWriteStream[] = [];

        for (let file of entries)
        {
            let fileName = Path.changeExt(file, "js");
            let stream = bundlers[file].bundle().on(
                "error",
                (error) =>
                {
                    let message: string = error.message;
                    if (!errorMessages.includes(message))
                    {
                        errorMessages.push(message);
                        log.error(message);
                    }
                }
            ).pipe(
                source(fileName)
            ).pipe(
                buffer()
            );

            streams.push(stream);
        }

        let stream = merge(streams).pipe(
            gulp.dest(settings.DestinationPath())
        );

        if (settings.Watch)
        {
            let tempDir = new TempDirectory();

            let watcherStream = watcher.bundle().on(
                "error",
                () => { }
            ).pipe(
                source(Path.basename(tempDir.FullName))
            ).pipe(
                buffer()
            ).pipe(
                gulp.dest(tempDir.MakePath())
            );

            Promise.all(
                [
                    new Promise(
                        (resolve) =>
                        {
                            stream.on("end", resolve);
                        }),
                    new Promise(
                        (resolve) =>
                        {
                            watcherStream.on("end", resolve);
                        })
                ]).then(
                    () =>
                    {
                        tempDir.Dispose();
                        log.info(`Found ${errorMessages.length} errors. Watching for file changes.`);
                    });
        }

        return stream;
    }

    build.displayName = Build.displayName;
    build.description = Build.description;
    return build();
}
Build.description = "Builds the project";

export default Build;