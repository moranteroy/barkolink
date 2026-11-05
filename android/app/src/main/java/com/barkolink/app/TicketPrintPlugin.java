package com.barkolink.app;

import android.content.Context;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Uses Android's print / Save as PDF sheet with only the generated ticket HTML. */
@CapacitorPlugin(name = "TicketPrint")
public class TicketPrintPlugin extends Plugin {
    private WebView printView;

    @PluginMethod
    public void print(PluginCall call) {
        String html = call.getString("html");
        String jobName = call.getString("jobName", "BarkoLink ticket");
        if (html == null || html.isEmpty() || html.length() > 4000000) {
            call.reject("A valid ticket document is required.");
            return;
        }
        getActivity().runOnUiThread(() -> {
            if (printView != null) {
                call.reject("Close the current print sheet before printing another ticket.");
                return;
            }
            PrintManager manager = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
            if (manager == null) {
                call.reject("Printing is unavailable on this device.");
                return;
            }
            printView = new WebView(getActivity());
            printView.getSettings().setJavaScriptEnabled(false);
            printView.getSettings().setAllowFileAccess(false);
            printView.getSettings().setBlockNetworkLoads(true);
            printView.getSettings().setTextZoom(100);
            printView.setWebViewClient(new WebViewClient() {
                private boolean started;
                @Override public void onPageFinished(WebView view, String url) {
                    if (started) return;
                    started = true;
                    try {
                        PrintDocumentAdapter delegate = view.createPrintDocumentAdapter(jobName);
                        PrintDocumentAdapter adapter = new PrintDocumentAdapter() {
                            @Override public void onStart() { delegate.onStart(); }
                            @Override public void onLayout(PrintAttributes oldAttributes, PrintAttributes newAttributes,
                                    CancellationSignal signal, LayoutResultCallback callback, Bundle extras) {
                                delegate.onLayout(oldAttributes, newAttributes, signal, callback, extras);
                            }
                            @Override public void onWrite(PageRange[] pages, ParcelFileDescriptor destination,
                                    CancellationSignal signal, WriteResultCallback callback) {
                                delegate.onWrite(pages, destination, signal, callback);
                            }
                            @Override public void onFinish() {
                                delegate.onFinish();
                                getActivity().runOnUiThread(() -> releasePrintView());
                            }
                        };
                        manager.print(jobName, adapter, new PrintAttributes.Builder()
                                .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                                .setColorMode(PrintAttributes.COLOR_MODE_COLOR).build());
                        call.resolve();
                    } catch (Exception error) {
                        releasePrintView();
                        call.reject("Could not open Android ticket printing.");
                    }
                }
            });
            printView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
        });
    }

    private void releasePrintView() {
        if (printView != null) {
            printView.destroy();
            printView = null;
        }
    }

    @Override protected void handleOnDestroy() {
        getActivity().runOnUiThread(() -> releasePrintView());
    }
}
