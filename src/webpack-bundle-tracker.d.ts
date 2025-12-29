export = BundleTrackerPlugin;
declare namespace BundleTrackerPlugin {
  interface Contents {
    /**
     * Status of webpack
     */
    status: string;
    /**
     * Error when webpack has failure from compilation
     */
    error?: string;
    /**
     * Error message when webpack has failure from compilation
     */
    message?: string;
    /**
     * File information
     */
    assets: {
      [name: string]: {
        name: string;
        integrity?: string;
        publicPath?: string;
        path: string;
      };
    };
    /**
     * List of chunks builded: corrected from the original source
     */
    chunks: {
      [name: string]: string[];
    };
    /**
     * Public path of chunks
     */
    publicPath?: string;
    /**
     * Start time of webpack compilation
     */
    startTime?: number;
    /**
     * End time of webpack compilation
     */
    endTime?: number;
  }
}
