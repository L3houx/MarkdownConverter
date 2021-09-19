import { strictEqual } from "assert";
import { dirname, normalize } from "path";
import { TempFile } from "@manuth/temp-files";
import { createSandbox, SinonSandbox } from "sinon";
import { resolve } from "upath";
import { TextDocument, window, workspace } from "vscode";
import { ConversionType } from "../../../../Conversion/ConversionType";
import { ISettings } from "../../../../Properties/ISettings";
import { Settings } from "../../../../Properties/Settings";
import { ConversionRunner } from "../../../../System/Tasks/ConversionRunner";
import { ITestContext } from "../../../ITestContext";
import { SubstitutionTester } from "../../../SubstitutionTester";
import { TestConstants } from "../../../TestConstants";

/**
 * Registers tests for the {@link ConversionRunner `ConversionRunner`} class.
 *
 * @param context
 * The test-context.
 */
export function ConversionRunnerTests(context: ITestContext<ISettings>): void
{
    suite(
        nameof(ConversionRunner),
        () =>
        {
            let workspaceFolderPattern = "${workspaceFolder}";

            suite(
                nameof<ConversionRunner>((runner) => runner.Execute),
                () =>
                {
                    suite(
                        `Checking whether the \`${nameof<Settings>((s) => s.DestinationPattern)}\` is substituted correctly…`,
                        () =>
                        {
                            let sandbox: SinonSandbox;
                            let tempFile: TempFile;
                            let document: TextDocument;
                            let untitledDocument: TextDocument;
                            let substitutionTester: SubstitutionTester;

                            suiteSetup(
                                async () =>
                                {
                                    tempFile = new TempFile(
                                        {
                                            Suffix: ".md"
                                        });

                                    document = await workspace.openTextDocument(tempFile.FullName);
                                    untitledDocument = await workspace.openTextDocument();
                                    substitutionTester = new SubstitutionTester(new ConversionRunner(TestConstants.Extension));
                                });

                            suiteTeardown(
                                async () =>
                                {
                                    tempFile.Dispose();
                                });

                            setup(
                                () =>
                                {
                                    sandbox = createSandbox();

                                    context.Settings.ConversionType = [
                                        nameof(ConversionType.PDF)
                                    ] as Array<keyof typeof ConversionType>;
                                });

                            teardown(
                                () =>
                                {
                                    sandbox.restore();
                                });

                            test(
                                `Checking whether the user is prompted to specify the \`${workspaceFolderPattern}\`-path if the file is untitled and no workspace is opened…`,
                                async function()
                                {
                                    this.slow(5 * 1000);
                                    this.timeout(10 * 1000);
                                    let inputWorkspaceName = "This is a workspace-folder for testing";
                                    sandbox.replace(window, "showInputBox", async () => inputWorkspaceName);
                                    strictEqual(await substitutionTester.Test(untitledDocument, workspaceFolderPattern), resolve(inputWorkspaceName));
                                    let pattern = "./Test";
                                    strictEqual(await substitutionTester.Test(untitledDocument, pattern), resolve(inputWorkspaceName, pattern));
                                });

                            test(
                                `Checking whether the \`${workspaceFolderPattern}\` is replaced with the name of the directory containing the file…`,
                                async () =>
                                {
                                    strictEqual(
                                        normalize(await substitutionTester.Test(document, workspaceFolderPattern)),
                                        normalize(dirname(tempFile.FullName)));
                                });
                        });
                });
        });
}
