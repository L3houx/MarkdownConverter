import Path = require("path");
import { Package } from "@manuth/package-json-editor";
import { CultureInfo } from "culture-info";
import MarkdownIt = require("markdown-it");
import PkgUp = require("pkg-up");
import Format = require("string-template");
import { commands, env, ExtensionContext, ProgressLocation, Uri, ViewColumn, window, workspace } from "vscode";
import { Resources } from "../../Properties/Resources";
import { Task } from "../Tasks/Task";

/**
 * Represents an extension.
 */
export class Extension
{
    /**
     * The context of the extension.
     */
    private context: ExtensionContext = null;

    /**
     * The path to the extension-manifest.
     */
    private extensionManifestPath: string;

    /**
     * The path to the root of the extension.
     */
    private extensionRoot: string;

    /**
     * The meta-data of the extension.
     */
    private metaData: Package;

    /**
     * The parser provided by `Visual Studio Code`
     */
    private vsCodeParser: MarkdownIt;

    /**
     * A promise for waiting for the system-parser to be fixed.
     */
    private systemParserFixPromise: Promise<void>;

    /**
     * A method for resolving the system-parser fix.
     */
    private systemParserFixResolver: () => void;

    /**
     * Initializes a new instance of the `Extension` class.
     *
     * @param extensionRoot
     * The root of the extension.
     */
    public constructor(extensionRoot: string)
    {
        this.extensionManifestPath = PkgUp.sync({ cwd: extensionRoot });
        this.extensionRoot = Path.dirname(this.extensionManifestPath);
        this.metaData = new Package(Path.join(this.extensionManifestPath));
        this.systemParserFixPromise = new Promise(
            (resolve) =>
            {
                this.systemParserFixResolver = resolve;
            });

        Resources.Culture = new CultureInfo(env.language);
    }

    /**
     * Gets context of the of the extension.
     */
    public get Context(): ExtensionContext
    {
        return this.context;
    }

    /**
     * Gets the path to the root of the extension.
     */
    public get ExtensionRoot(): string
    {
        return this.extensionRoot;
    }

    /**
     * Gets the meta-data of the extension.
     */
    public get MetaData(): Package
    {
        return this.metaData;
    }

    /**
     * Gets the author of the extension.
     */
    public get Author(): string
    {
        return this.MetaData.AdditionalProperties.Get("publisher") as string;
    }

    /**
     * Gets the name of the extension.
     */
    public get Name(): string
    {
        return this.MetaData.Name;
    }

    /**
     * Gets the full name of the extension.
     */
    public get FullName(): string
    {
        return `${this.Author}.${this.Name}`;
    }

    /**
     * Gets the parser provided by Visual Studio Code.
     */
    public get VSCodeParser(): MarkdownIt
    {
        return this.vsCodeParser;
    }

    /**
     * Activates the extension.
     *
     * @param context
     * A collection of utilities private to an extension.
     *
     * @returns
     * The extension-body.
     */
    public async Active(context: ExtensionContext): Promise<unknown>
    {
        this.context = context;

        return {
            extendMarkdownIt: (md: any) =>
            {
                this.vsCodeParser = md;
                this.resolveFix();
                return md;
            }
        };
    }

    /**
     * Disposes the extension.
     */
    public async Dispose(): Promise<void>
    { }

    /**
     * Enables the system-parser.
     */
    public async EnableSystemParser(): Promise<void>
    {
        if (!this.VSCodeParser)
        {
            await window.showTextDocument(
                await workspace.openTextDocument(Uri.parse("untitled:.md")),
                {
                    viewColumn: ViewColumn.Beside,
                    preview: true
                });

            await commands.executeCommand("markdown.showPreview");
            await commands.executeCommand("workbench.action.closeActiveEditor");
            await commands.executeCommand("workbench.action.closeActiveEditor");
        }

        return this.systemParserFixPromise;
    }

    /**
     * Executes a task.
     *
     * @param task
     * The task to execute.
     */
    protected async ExecuteTask(task: Task): Promise<void>
    {
        try
        {
            await this.ExecuteTaskInternal(task);
        }
        catch (exception)
        {
            let message: string;

            if (exception instanceof Error)
            {
                message = Format(Resources.Resources.Get("UnknownException"), exception.name, exception.message);
            }
            else
            {
                message = Format(Resources.Resources.Get("UnknownError"), exception);
            }

            window.showErrorMessage(message);
        }
    }

    /**
     * Executes a task.
     *
     * @param task
     * The task to execute.
     */
    protected async ExecuteTaskInternal(task: Task): Promise<void>
    {
        return window.withProgress(
            {
                cancellable: task.Cancellable,
                location: ProgressLocation.Notification,
                title: task.Title
            },
            async (progressReporter, cancellationToken) =>
            {
                await task.Execute(progressReporter, cancellationToken);
            });
    }

    /**
     * Resolves the system-parser fix.
     */
    private resolveFix(): void
    {
        this.systemParserFixResolver();
    }
}