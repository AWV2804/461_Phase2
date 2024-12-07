import { metric_manager } from "./metric_manager.js";


/**
 * Formats the given URL and metrics into a JSON string.
 *
 * @param url - The URL to be formatted.
 * @param metric_array - An array of metrics to be included in the formatted string.
 * @param test_metric - An object containing various latency metrics.
 * @returns A JSON string containing the formatted URL and metrics.
 */
export function output_formatter(url: string, metric_array: any[], test_metric: metric_manager): string {
    const fixed_url: string = url.trim();
    const formatted_string: string = '{"URL": ' + '"' + fixed_url + '"' + ', ' +
        '"NetScore": ' + `${test_metric.net_score.toFixed(3)}, ` +
        '"NetScore_Latency": ' + `${test_metric.net_score_latency.toFixed(3)}, ` +
        '"RampUp": ' + `${metric_array[2].toFixed(3)}, ` +
        '"RampUp_Latency": ' + `${test_metric.ramp_up_latency.toFixed(3)}, ` +
        '"Correctness": ' + `${metric_array[1].toFixed(3)},` +
        '"Correctness_Latency": ' + `${test_metric.correctness_latency.toFixed(3)}, ` +
        '"BusFactor": ' + `${metric_array[0].toFixed(3)}, ` +
        '"BusFactor_Latency": ' + `${test_metric.bus_factor_latency.toFixed(3)}, ` +
        '"ResponsiveMaintainer": ' + `${metric_array[3].toFixed(3)}, ` +
        '"ResponsiveMaintainer_Latency": ' + `${test_metric.maintainer_latency.toFixed(3)}, ` +
        '"License": ' + `${metric_array[4].toFixed(3)}, ` +
        '"License_Latency": ' + `${test_metric.license_latency.toFixed(3)}, ` +
        '"PullRequestsCodeMetric": ' + `${metric_array[5].toFixed(3)}, ` +
        '"PullRequestsCodeMetric_Latency": ' + `${test_metric.pull_requests_code_metric_latency.toFixed(3)}, ` +
        '"DependencyPinning": ' + `${metric_array[6].toFixed(3)}, ` +
        '"DependencyPinning_Latency": ' + `${test_metric.dependency_pinning_latency.toFixed(3)}}\n`;

    return formatted_string
}
