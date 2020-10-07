import { deepStrictEqual, ok, strictEqual } from "assert";
import { env } from "vscode";
import { ConversionType } from "../../../Conversion/ConversionType";
import { Settings } from "../../../Properties/Settings";
import { CustomPaperFormat } from "../../../System/Documents/CustomPaperFormat";
import { EmojiType } from "../../../System/Documents/EmojiType";
import { ListType } from "../../../System/Documents/ListType";
import { Margin } from "../../../System/Documents/Margin";
import { PaperOrientation } from "../../../System/Documents/PaperOrientation";
import { StandardizedFormatType } from "../../../System/Documents/StandardizedFormatType";
import { StandardizedPaperFormat } from "../../../System/Documents/StandardizedPaperFormat";
import { ConfigRestorer } from "../../ConfigRestorer";
import { TestSettings } from "./TestSettings";

/**
 * Registers tests for the `Settings` class.
 */
export function SettingTests(): void
{
    suite(
        "Settings",
        () =>
        {
            let settings: TestSettings;
            let configRestorer: ConfigRestorer;

            suiteSetup(
                async () =>
                {
                    settings = new TestSettings();

                    configRestorer = new ConfigRestorer(
                        [
                            "ConversionType",
                            "Locale",
                            "Parser.EmojiType",
                            "Document.Paper.Margin",
                            "Document.Paper.PaperFormat",
                            "Parser.Toc.Enabled",
                            "Parser.Toc.ListType"
                        ],
                        Settings.ConfigKey);

                    await configRestorer.Clear();
                });

            suiteTeardown(
                async () =>
                {
                    await configRestorer.Restore();
                });

            setup(
                () =>
                {
                    settings.Resource.Resource = {};
                });

            suite(
                "ConversionType",
                () =>
                {
                    test(
                        "Checking whether the default conversion-type is set correctly…",
                        () =>
                        {
                            deepStrictEqual(settings.ConversionType, [ConversionType.PDF]);
                        });

                    test(
                        "Checking whether the conversion-types are resolved correctly…",
                        () =>
                        {
                            settings.Resource.Resource["ConversionType"] = ["HTML"] as Array<keyof typeof ConversionType>;
                            strictEqual(settings.ConversionType[0], ConversionType.HTML);
                        });
                });

            suite(
                "Locale",
                () =>
                {
                    test(
                        "Checking whether the locale-setting is loaded correctly…",
                        () =>
                        {
                            settings.Resource.Resource["Locale"] = "de";
                            strictEqual(settings.Locale, "de");
                        });

                    test(
                        "Checking whether the locale defaults to the locale of vscode…",
                        () =>
                        {
                            strictEqual(settings.Locale, env.language);
                        });
                });

            suite(
                "EmojiType",
                () =>
                {
                    test(
                        "Checking whether the emoji-type is resolved correctly…",
                        () =>
                        {
                            settings.Resource.Resource["Parser.EmojiType"] = "Native" as keyof typeof EmojiType;
                            strictEqual(settings.EmojiType, EmojiType.Native);
                        });
                });

            suite(
                "PaperFormat",
                () =>
                {
                    let paperKey = "Document.Paper";
                    let formatKey = `${paperKey}.PaperFormat`;
                    let checkMargin: (margin: Margin) => void;

                    setup(
                        () =>
                        {
                            let newMargin = {
                                Top: "12cm",
                                Left: "78cm",
                                Bottom: "10cm",
                                Right: "20cm"
                            };

                            settings.Resource.Resource = {
                                [`${paperKey}.Margin`]: newMargin
                            };

                            checkMargin = (margin: Margin) =>
                            {
                                strictEqual(margin.Top, newMargin.Top);
                                strictEqual(margin.Left, newMargin.Left);
                                strictEqual(margin.Bottom, newMargin.Bottom);
                                strictEqual(margin.Right, newMargin.Right);
                            };
                        });

                    test(
                        "Checking whether a correct custom paper-format is loaded if width and height is specified…",
                        () =>
                        {
                            let customFormat = {
                                Width: "28cm",
                                Height: "29cm"
                            };

                            Object.assign(
                                settings.Resource.Resource,
                                {
                                    [formatKey]: customFormat
                                });

                            let paperFormat = settings.PaperFormat.Format as CustomPaperFormat;
                            ok(settings.PaperFormat.Format instanceof CustomPaperFormat);
                            strictEqual(paperFormat.Width, customFormat.Width);
                            strictEqual(paperFormat.Height, customFormat.Height);
                            checkMargin(settings.PaperFormat.Margin);
                        });

                    test(
                        "Checking whether a correct standardized paper-format is loaded if either width or height is not specified…",
                        () =>
                        {
                            Object.assign(
                                settings.Resource.Resource,
                                {
                                    [`${formatKey}.Format`]: "A5" as keyof typeof StandardizedFormatType,
                                    [`${formatKey}.Orientation`]: "Landscape" as keyof typeof PaperOrientation
                                });

                            let paperFormat = settings.PaperFormat.Format as StandardizedPaperFormat;
                            ok(settings.PaperFormat.Format instanceof StandardizedPaperFormat);
                            strictEqual(paperFormat.Format, StandardizedFormatType.A5);
                            strictEqual(paperFormat.Orientation, PaperOrientation.Landscape);
                            checkMargin(settings.PaperFormat.Margin);
                        });

                    test(
                        "Checking whether the default paper-format is correct…",
                        () =>
                        {
                            let paperFormat = settings.PaperFormat.Format as StandardizedPaperFormat;
                            ok(settings.PaperFormat.Format instanceof StandardizedPaperFormat);
                            strictEqual(paperFormat.Format, StandardizedFormatType.A4);
                            strictEqual(paperFormat.Orientation, PaperOrientation.Portrait);
                            checkMargin(settings.PaperFormat.Margin);
                        });
                });

            suite(
                "TocSettings",
                () =>
                {
                    test(
                        "Checking whether the `Toc`-settings equals null if toc is disabled…",
                        () =>
                        {
                            settings.Resource.Resource["Parser.Toc.Enabled"] = false;
                            strictEqual(settings.TocSettings, null);
                        });

                    test(
                        "Checking whether the `ListType`-option is parsed correctly…",
                        () =>
                        {
                            settings.Resource.Resource["Parser.Toc.Enabled"] = true;
                            settings.Resource.Resource["Parser.Toc.ListType"] = "ul";
                            strictEqual(settings.TocSettings.ListType, ListType.Unordered);
                            settings.Resource.Resource["Parser.Toc.ListType"] = "ol";
                            strictEqual(settings.TocSettings.ListType, ListType.Ordered);
                        });
                });
        });
}
