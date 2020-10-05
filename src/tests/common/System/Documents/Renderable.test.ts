import { strictEqual } from "assert";
import { Renderable } from "../../../../System/Documents/Renderable";

suite(
    "Renderable",
    () =>
    {
        /**
         * Provides an implementation of the `Renderable` class for testing.
         */
        class TestRenderable extends Renderable
        {
            /**
             * @inheritdoc
             *
             * @param text
             * The text to render.
             *
             * @returns
             * The rendered text.
             */
            protected async RenderText(text: string): Promise<string>
            {
                return text;
            }
        }

        let verifier: string;
        let otherVerifier: string;
        let text: string;
        let renderer: Renderable;
        let otherRenderer: Renderable;

        suiteSetup(
            () =>
            {
                verifier = "rendered: ";
                otherVerifier = "other rendered: ";
                text = "hello world";

                renderer = new class extends Renderable
                {
                    /**
                     * @inheritdoc
                     *
                     * @param text
                     * The text to render.
                     *
                     * @returns
                     * The rendered text.
                     */
                    protected async RenderText(text: string): Promise<string>
                    {
                        return verifier + text;
                    }
                }(text);

                otherRenderer = new class extends Renderable
                {
                    /**
                     * @inheritdoc
                     *
                     * @param text
                     * The text to render.
                     *
                     * @returns
                     * The rendered text.
                     */
                    protected async RenderText(text: string): Promise<string>
                    {
                        return otherVerifier + text;
                    }
                }(text);
            });

        suite(
            "constructor(string content?)",
            () =>
            {
                test(
                    "Checking whether the values are set correctly…",
                    () =>
                    {
                        let renderer = new TestRenderable();
                        strictEqual(renderer.Content, "");
                        renderer = new TestRenderable("hello");
                        strictEqual(renderer.Content, "hello");
                    });
            });

        suite(
            "Render()",
            () =>
            {
                test(
                    "Checking whether text can be renderer…",
                    async () =>
                    {
                        strictEqual(await renderer.Render(), verifier + text);
                    });
            });

        suite(
            "RenderTextBy(Renderable renderer, string text)",
            () =>
            {
                test(
                    "Checking whether text can be rendered by another Renderable…",
                    async () =>
                    {
                        strictEqual(await renderer["RenderTextBy"](otherRenderer, renderer.Content), otherVerifier + text);
                    });
            });
    });
