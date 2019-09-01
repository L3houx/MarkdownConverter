/**
 * Represents the position in a text.
 */
export interface IMark
{
    /**
     * Gets or sets the name of the marker.
     */
    name: string;

    /**
     * Gets or sets the text.
     */
    buffer: Buffer;

    /**
     * Gets or sets the position.
     */
    position: number;

    /**
     * Gets or sets the line-number of the position to mark.
     */
    line: number;

    /**
     * Gets or sets the column-number of the position to mark.
     */
    column: number;

    /**
     * Generates a string representing the marker.
     *
     * @param indent
     * The indentation of the error-message.
     *
     * @param maxLength
     * The max number of characters to render in a row.
     *
     * @returns
     * A string representing the marker.
     */
    getSnippet(indent?: number, maxLength?: number): string;

    /**
     * Generates a string representing the marker.
     *
     * @param indent
     * The indentation of the error-message.
     *
     * @param maxLength
     * The max number of characters to render in a row.
     *
     * @returns
     * A string representing the marker.
     */
    toString(compact?: boolean): string;
}