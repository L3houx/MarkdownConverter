import { basename } from "path";
import { TaskTests } from "./Tasks";

/**
 * Registers tests for system-components.
 */
export function SystemTests(): void
{
    suite(
        basename(__dirname),
        () =>
        {
            TaskTests();
        });
}
