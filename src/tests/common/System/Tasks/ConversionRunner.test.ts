import { notStrictEqual, ok, strictEqual } from "assert";
import { EOL } from "os";
import { dirname, join, parse } from "path";
import { load } from "cheerio";
import dedent = require("dedent");
import { readFile, writeFile } from "fs-extra";
import MultiRange from "multi-integer-range";
import { TempDirectory, TempFile } from "temp-filesystem";
import { commands, ConfigurationTarget, Uri, window, workspace, WorkspaceConfiguration } from "vscode";
import { ConversionType } from "../../../../Conversion/ConversionType";
import { MarkdownConverterExtension } from "../../../../MarkdownConverterExtension";
import { Settings } from "../../../../Properties/Settings";
import { EmojiType } from "../../../../System/Documents/EmojiType";
import { Margin } from "../../../../System/Documents/Margin";
import { PaperOrientation } from "../../../../System/Documents/PaperOrientation";
import { StandardizedFormatType } from "../../../../System/Documents/StandardizedFormatType";
import { StandardizedPaperFormat } from "../../../../System/Documents/StandardizedPaperFormat";
import { ConversionRunner } from "../../../../System/Tasks/ConversionRunner";
import { ConfigRestorer } from "../../../ConfigRestorer";
import { SubstitutionTester } from "../../../SubstitutionTester";

suite(
    "ConversionRunner",
    () =>
    {
        let config: WorkspaceConfiguration;
        let configRestorer: ConfigRestorer;
        let markdownConfig: WorkspaceConfiguration;
        let markdownRestorer: ConfigRestorer;
        let mdFile: TempFile;
        let destinationFile: TempFile;
        let Convert: () => Promise<void>;

        let Clean: Mocha.AsyncFunc = async function()
        {
            this.slow(2 * 1000);
            this.timeout(8 * 1000);
            await markdownRestorer.Clear();
            await configRestorer.Clear();
            await writeFile(mdFile.FullName, "");
            await markdownConfig.update("ConversionType", [ConversionType[ConversionType.HTML]], true);
            await markdownConfig.update("DestinationPattern", destinationFile.FullName, true);
            await markdownConfig.update("Parser.SystemParserEnabled", false, true);
        };

        suiteSetup(
            async () =>
            {
                config = workspace.getConfiguration();

                configRestorer = new ConfigRestorer(
                    [
                        "markdown.preview.breaks"
                    ]);

                markdownConfig = workspace.getConfiguration(Settings["configKey"]);

                markdownRestorer = new ConfigRestorer(
                    [
                        "ConversionType",
                        "ConversionQuality",
                        "DestinationPattern",
                        "Locale",
                        "DateFormat",
                        "Document.Attributes",
                        "Document.Paper.PaperFormat",
                        "Document.Paper.Margin",
                        "Document.Design.Template",
                        "Document.Design.HighlightStyle",
                        "Document.Design.StyleSheets",
                        "Document.HeaderFooterEnabled",
                        "Document.HeaderTemplate",
                        "Document.FooterTemplate",
                        "Parser.SystemParserEnabled",
                        "Parser.Toc.Enabled",
                        "Parser.Toc.Class",
                        "Parser.Toc.Levels",
                        "Parser.Toc.Indicator",
                        "Parser.Toc.ListType",
                        "Parser.EmojiType"
                    ],
                    Settings["configKey"]);

                await markdownRestorer.Clear();
                await configRestorer.Clear();

                mdFile = new TempFile(
                    {
                        postfix: ".md"
                    });

                destinationFile = new TempFile(
                    {
                        postfix: ".html"
                    });

                await window.showTextDocument(Uri.file(mdFile.FullName));

                Convert = async () =>
                {
                    await commands.executeCommand("workbench.action.closeAllGroups");
                    await window.showTextDocument(Uri.file(mdFile.FullName));
                    await commands.executeCommand("markdown.showPreview");
                    await commands.executeCommand("workbench.action.closeAllGroups");
                    await window.showTextDocument(Uri.file(mdFile.FullName));
                    await commands.executeCommand("workbench.action.files.revert");
                    await commands.executeCommand("workbench.action.focusFirstEditorGroup");
                    await new Promise((resolve) => setTimeout(resolve, 100));
                    await commands.executeCommand("markdownConverter.Convert");
                };
            });

        suiteTeardown(
            async () =>
            {
                await markdownRestorer.Restore();
                await configRestorer.Restore();
                mdFile.Dispose();
                destinationFile.Dispose();
            });

        setup(Clean);

        suite(
            "LoadParser()",
            () =>
            {
                setup(Clean);

                test(
                    "Checking whether the system-parser is used if `markdownConverter.Parser.SystemParserEnabled` is true…",
                    async function()
                    {
                        this.slow(6.5 * 1000);
                        this.timeout(26 * 1000);
                        let firstResult: string;
                        let secondResult: string;
                        await writeFile(mdFile.FullName, "line1" + EOL + "line2");
                        await markdownConfig.update("Parser.SystemParserEnabled", true, ConfigurationTarget.Global);
                        await config.update("markdown.preview.breaks", true, ConfigurationTarget.Global);
                        await Convert();
                        firstResult = (await readFile(destinationFile.FullName)).toString();
                        await config.update("markdown.preview.breaks", false, ConfigurationTarget.Global);
                        await Convert();
                        secondResult = (await readFile(destinationFile.FullName)).toString();
                        notStrictEqual(firstResult, secondResult);
                    });

                test(
                    "Checking whether the system-parser is disabled if `markdownConverter.Parser.SystemParserEnabled` is false…",
                    async function()
                    {
                        this.slow(2.5 * 1000);
                        this.timeout(10 * 1000);
                        await writeFile(
                            mdFile.FullName,
                            dedent(
                                `
                                <b>test</b>
                                \`\`\`cs
                                Console.WriteLine("Test")
                                \`\`\``));

                        await commands.executeCommand("workbench.action.files.revert");
                        await markdownConfig.update("Parser.SystemParserEnabled", false, ConfigurationTarget.Global);
                        await Convert();
                        let result = load((await readFile(destinationFile.FullName)).toString());
                        strictEqual(result("b:contains('test')").length, 1);
                        strictEqual(result("pre.hljs").length, 1);
                    });

                test(
                    "Checking whether anchors are created correctly…",
                    async function()
                    {
                        this.slow(3 * 1000);
                        this.timeout(12 * 1000);
                        await writeFile(
                            mdFile.FullName,
                            dedent(
                                `
                                # Test
                                # Test`));

                        await commands.executeCommand("workbench.action.files.revert");
                        await Convert();
                        let result = load((await readFile(destinationFile.FullName)).toString());
                        strictEqual(result("#test").length, 1);
                        strictEqual(result("#test-2").length, 1);
                    });

                test(
                    "Checking whether the toc is applied according to the settings…",
                    async function()
                    {
                        this.slow(3.5 * 1000);
                        this.timeout(14 * 1000);
                        let tocClass = "markdown-converter-toc-test";
                        let levels = new MultiRange([2]).toString();
                        let indicator = "\\[\\[\\s*toc-test\\s*\\]\\]";
                        let listType = "ol";
                        let excludedHeading = "Not Included";
                        let includedHeading = "Included";

                        await writeFile(
                            mdFile.FullName,
                            dedent(
                                `
                                # Table of Contents
                                [[toc-test]]

                                # ${excludedHeading}
                                ## ${includedHeading}`));

                        await markdownConfig.update("Parser.Toc.Enabled", true, ConfigurationTarget.Global);
                        await markdownConfig.update("Parser.Toc.Class", tocClass, ConfigurationTarget.Global);
                        await markdownConfig.update("Parser.Toc.Levels", levels, ConfigurationTarget.Global);
                        await markdownConfig.update("Parser.Toc.Indicator", indicator, ConfigurationTarget.Global);
                        await markdownConfig.update("Parser.Toc.ListType", listType, ConfigurationTarget.Global);
                        await Convert();
                        let result = load((await readFile(destinationFile.FullName)).toString());
                        strictEqual(result(`.${tocClass}`).length, 1);
                        strictEqual(result('ol li a[href="#included"]').length, 1);
                        strictEqual(result('ol li a[href="#not-included"]').length, 0);
                    });

                test(
                    "Checking whether checkboxes are rendered…",
                    async function()
                    {
                        this.slow(2.5 * 1000);
                        this.timeout(10 * 1000);
                        await writeFile(
                            mdFile.FullName,
                            dedent(
                                `
                                # ToDo's
                                - [ ] Rob a bank
                                - [ ] Get rich
                                - [ ] Buy a new monitor`));

                        await Convert();
                        let result = load((await readFile(destinationFile.FullName)));
                        strictEqual(result('li input[type="checkbox"]').length, 3);
                    });

                test(
                    "Checking whether emojis are rendered according to the `Parser.EmojiType`-setting…",
                    async function()
                    {
                        this.slow(5.5 * 1000);
                        this.timeout(22 * 1000);
                        let result: cheerio.Root;
                        await writeFile(mdFile.FullName, "**:sparkles:**");
                        await commands.executeCommand("workbench.action.files.revert");
                        await markdownConfig.update("Parser.EmojiType", EmojiType[EmojiType.None], ConfigurationTarget.Global);
                        await Convert();
                        result = load((await readFile(destinationFile.FullName)).toString());
                        strictEqual(
                            result("b:contains(':sparkles:')").length +
                            result("strong:contains(':sparkles:')").length,
                            1);
                        await markdownConfig.update("Parser.EmojiType", EmojiType[EmojiType.GitHub], ConfigurationTarget.Global);
                        await Convert();
                        result = load((await readFile(destinationFile.FullName)).toString());
                        strictEqual(result("b img").length + result("strong img").length, 1);
                    });
            });

        suite(
            "LoadConverter(string workspaceRoot, TextDocument document)",
            () =>
            {
                setup(Clean);

                test(
                    "Checking whether the settings are applied correctly…",
                    async function()
                    {
                        this.slow(4.25 * 1000);
                        this.timeout(17 * 1000);
                        let workspaceRoot = new TempDirectory();
                        let textDocument = await workspace.openTextDocument({ language: "markdown" });
                        let conversionQuality = 78;
                        let attributes = {
                            hello: "world",
                            this: "is a test"
                        };
                        let locale = "en";
                        let dateFormat = "yyyy/MM/dd";
                        let paperFormat: Partial<StandardizedPaperFormat> = {
                            Format: StandardizedFormatType.Tabloid,
                            Orientation: PaperOrientation.Landscape
                        };
                        let margin: Partial<Margin> = {
                            Top: "29cm",
                            Left: "9mm",
                            Bottom: "18cm",
                            Right: "1m"
                        };
                        let templateFile = new TempFile();
                        let highlightStyle = "agate";
                        let styleSheet = new TempFile();
                        let headerFooterEnabled = false;
                        let headerTemplate = "Hello";
                        let footerTemplate = "World";

                        await writeFile(templateFile.FullName, "This is a test template");
                        await markdownConfig.update("ConversionQuality", conversionQuality, ConfigurationTarget.Global);
                        await markdownConfig.update("Document.Attributes", attributes, ConfigurationTarget.Global);
                        await markdownConfig.update("Locale", locale, ConfigurationTarget.Global);
                        await markdownConfig.update("DateFormat", dateFormat, ConfigurationTarget.Global);
                        await markdownConfig.update(
                            "Document.Paper.PaperFormat",
                            {
                                Format: StandardizedFormatType[paperFormat.Format] as any,
                                Orientation: PaperOrientation[paperFormat.Orientation] as any
                            } as Partial<StandardizedPaperFormat>,
                            ConfigurationTarget.Global);
                        await markdownConfig.update("Document.Paper.Margin", margin, ConfigurationTarget.Global);
                        await markdownConfig.update("Document.Design.Template", templateFile.FullName, ConfigurationTarget.Global);
                        await markdownConfig.update("Document.Design.HighlightStyle", highlightStyle, ConfigurationTarget.Global);
                        await markdownConfig.update("Document.Design.StyleSheets", [styleSheet.FullName], ConfigurationTarget.Global);
                        await markdownConfig.update("Document.HeaderFooterEnabled", headerFooterEnabled, ConfigurationTarget.Global);
                        await markdownConfig.update("Document.HeaderTemplate", headerTemplate, ConfigurationTarget.Global);
                        await markdownConfig.update("Document.FooterTemplate", footerTemplate, ConfigurationTarget.Global);
                        await Convert();

                        let converter = await new ConversionRunner({ VSCodeParser: {} } as MarkdownConverterExtension)["LoadConverter"](workspaceRoot.FullName, textDocument);
                        strictEqual(converter.Document.Quality, conversionQuality);

                        for (let key of Object.keys(attributes) as Array<keyof typeof attributes>)
                        {
                            strictEqual(attributes[key], converter.Document.Attributes[key]);
                        }

                        strictEqual(converter.Document.Locale.Name, locale);
                        strictEqual(converter.Document.DateFormat, dateFormat);
                        strictEqual((converter.Document.Paper.Format as StandardizedPaperFormat).Format, paperFormat.Format);
                        strictEqual((converter.Document.Paper.Format as StandardizedPaperFormat).Orientation, paperFormat.Orientation);

                        for (let key of Object.keys(margin) as Array<keyof typeof margin>)
                        {
                            strictEqual(converter.Document.Paper.Margin[key], margin[key]);
                        }

                        strictEqual(converter.Document.Template, (await readFile(templateFile.FullName)).toString());
                        ok(converter.Document.StyleSheets.filter((stylesheet) => stylesheet.includes(highlightStyle)).length > 0);
                        ok(converter.Document.StyleSheets.includes(styleSheet.FullName));
                        strictEqual(converter.Document.HeaderFooterEnabled, headerFooterEnabled);
                        strictEqual(converter.Document.Header.Content, headerTemplate);
                        strictEqual(converter.Document.Footer.Content, footerTemplate);

                        styleSheet.Dispose();
                        templateFile.Dispose();
                        workspaceRoot.Dispose();
                    });

                test(
                    "Checking whether the header- and footer-template are loaded from a file according to the attributes…",
                    async function()
                    {
                        this.slow(3 * 1000);
                        this.timeout(12 * 1000);
                        let header = "This is a header";
                        let footer = "This is a footer";
                        let headerTemplate = new TempFile();
                        let footerTemplate = new TempFile();
                        await writeFile(headerTemplate.FullName, header);
                        await writeFile(footerTemplate.FullName, footer);

                        await writeFile(
                            mdFile.FullName,
                            dedent(
                                `
                                ---
                                HeaderTemplate: ${headerTemplate.FullName}
                                FooterTemplate: ${footerTemplate.FullName}
                                ---`));

                        await Convert();

                        let converter = await new ConversionRunner(
                            { VSCodeParser: {} } as MarkdownConverterExtension)["LoadConverter"](
                                dirname(mdFile.FullName),
                                await workspace.openTextDocument(mdFile.FullName));

                        strictEqual(converter.Document.Header.Content, header);
                        strictEqual(converter.Document.Footer.Content, footer);
                        headerTemplate.Dispose();
                        footerTemplate.Dispose();
                    });
            });

        suite(
            "Execute(TextDocument document, Progress<IProgressState> progressReporter?, Progress<IConvertedFile> fileReporter?)",
            () =>
            {
                setup(Clean);

                suite(
                    "Checking whether the `DestinationPattern` is substituted correctly…",
                    () =>
                    {
                        let testFile: TempFile;
                        let tempDir: TempDirectory;
                        let substitutionTester: SubstitutionTester;

                        suiteSetup(
                            async () =>
                            {
                                testFile = new TempFile(
                                    {
                                        postfix: ".mkdwn"
                                    });

                                tempDir = new TempDirectory();
                                substitutionTester = new SubstitutionTester(await workspace.openTextDocument(Uri.file(testFile.FullName)));
                            });

                        suiteTeardown(
                            () =>
                            {
                                testFile.Dispose();
                                tempDir.Dispose();
                            });

                        test(
                            "${basename}",
                            async function()
                            {
                                this.slow(1.25 * 1000);
                                this.timeout(5 * 1000);
                                await markdownConfig.update("DestinationPattern", "${basename}", ConfigurationTarget.Global);
                                strictEqual(await substitutionTester.Test(), parse(testFile.FullName).name);
                            });

                        test(
                            "${extension}",
                            async function()
                            {
                                this.slow(1.25 * 1000);
                                this.timeout(5 * 1000);
                                await markdownConfig.update("ConversionType", [ConversionType[ConversionType.PDF]], ConfigurationTarget.Global);
                                await markdownConfig.update("DestinationPattern", "${extension}", ConfigurationTarget.Global);
                                strictEqual(await substitutionTester.Test(), "pdf");
                            });

                        test(
                            "${filename}",
                            async function()
                            {
                                this.slow(1.25 * 1000);
                                this.timeout(5 * 1000);
                                await markdownConfig.update("DestinationPattern", "${filename}", ConfigurationTarget.Global);
                                strictEqual(await substitutionTester.Test(), parse(testFile.FullName).base);
                            });

                        test(
                            "Checking whether the `DestinationPatterh` is normalized correctly…",
                            async function()
                            {
                                this.slow(1.25 * 1000);
                                this.timeout(5 * 1000);
                                await markdownConfig.update("DestinationPattern", join(tempDir.FullName, "/./test/.././///./."), ConfigurationTarget.Global);
                                strictEqual(Uri.file(await substitutionTester.Test()).fsPath, Uri.file(tempDir.FullName).fsPath);
                            });
                    });
            });
    });
