import { EOL } from "os";
import fm = require("front-matter");
import { renameSync } from "fs-extra";
import PDFMerger = require("pdf-merger-js");
import format = require("string-template");
import { dirname, join, parse } from "upath";
import { CancellationToken, commands, Progress, TextDocument, TextDocumentChangeReason, window, workspace } from "vscode";
import { IConvertedFile } from "../../Conversion/IConvertedFile";
import { MarkdownConverterExtension } from "../../MarkdownConverterExtension";
import { Resources } from "../../Properties/Resources";
import { Settings } from "../../Properties/Settings";
import { ConvertAllTask } from "./ConvertAllTask";
import { IProgressState } from "./IProgressState";

/**
 * Represents a task for chaining multiple documents.
 */
export class GenerateReportTask extends ConvertAllTask
{
    /**
     * Initializes a new instance of the {@link GenerateReportTask `GenerateReportTask`} class.
     *
     * @param extension
     * The extension the task belongs to.
     */
    public constructor(extension: MarkdownConverterExtension)
    {
        super(extension);
    }

    /**
     * @inheritdoc
     */
    public override get Title(): string
    {
        return Resources.Resources.Get<string>("TaskTitle.GenerateReport");
    }

    /**
     * @inheritdoc
     */
    public override get Cancellable(): boolean
    {
        return false;
    }

    /**
     * @inheritdoc
     *
     * @param progressReporter
     * A component for reporting progress.
     *
     * @param cancellationToken
     * A component for handling cancellation-requests.
     *
     * @param fileReporter
     * A component for reporting converted files.
     */
    protected override async ExecuteTask(progressReporter?: Progress<IProgressState>, cancellationToken?: CancellationToken, fileReporter?: Progress<IConvertedFile>): Promise<void>
    {
        let document: TextDocument;
        let documentName: string = null;
        let documents: TextDocument[] = [];

        progressReporter?.report(
            {
                message: Resources.Resources.Get("Progress.SearchDocuments")
            });

        documents = await this.GetDocuments();

        let activeTextEditorDirPath: string = dirname(documents[0].fileName);

        progressReporter?.report(
            {
                message: format(Resources.Resources.Get("Progress.DocumentsFound"), documents.length)
            });

        progressReporter?.report(
            {
                message: Resources.Resources.Get("Progress.ChainDocuments")
            });

        let filteredDocuments = documents.filter((document) =>
        {
            if (document.fileName.includes(Settings.Default.GenerateReportTitlePage) ||
                document.fileName.includes(Settings.Default.GenerateReportReport))
            {
                return document;
            }
            return null;
        });

        if(filteredDocuments.length === 0)
        {
            progressReporter?.report(
                {
                    message: format(Resources.Resources.Get("Progress.DocumentsFound"), filteredDocuments.length)
                });
        }
        else
        {
            while (!documentName)
            {
                documentName = await window.showInputBox(
                    {
                        ignoreFocusOut: true,
                        prompt: Resources.Resources.Get("DocumentName"),
                        placeHolder: Resources.Resources.Get("DocumentNameExample")
                    });
            }

            /*
            filteredDocuments.sort(
            (x, y) =>
            {
                return x.uri.toString().toLowerCase().localeCompare(y.uri.toString().toLowerCase());
            });
            */

            let merger = new PDFMerger();

            console.log("Step1");

            for await (document of filteredDocuments)
            {
                // Convert markdown to PDF
                await this.ConversionRunner.Execute(document, progressReporter, cancellationToken, fileReporter);

                // Add the document generated before to merge them later on
                merger.add(document.fileName.replace(".md", ".pdf"));
                console.log("document: ", document.fileName);
            }
            console.log("Step3");

            // Merge pdf
            await merger.save(activeTextEditorDirPath + "/" + documentName);
            console.log("Step4");
            await commands.executeCommand("workbench.action.revertAndCloseActiveEditor");
        }
    }
}
