import { basename } from "path";
import { ISettings } from "../../../Properties/ISettings";
import { ITestContext } from "../../ITestContext";
import { IOTests } from "./IO";
import { TaskTests } from "./Tasks";

/**
 * Registers tests for system-components.
 *
 * @param context
 * The test-context.
 */
export function SystemTests(context: ITestContext<ISettings>): void
{
    suite(
        basename(__dirname),
        () =>
        {
            IOTests();
            TaskTests(context);
        });
}
