package com.barkolink.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;
import java.util.concurrent.atomic.AtomicBoolean;

/** Saves the ticket through Android's document picker, without broad storage permissions. */
@CapacitorPlugin(name = "TicketFiles")
public class TicketFilesPlugin extends Plugin {
    private final AtomicBoolean saving = new AtomicBoolean(false);

    @PluginMethod
    public void save(PluginCall call) {
        String data = call.getString("data", "");
        String name = call.getString("name", "BarkoLink-ticket.pdf");
        if (data.isEmpty() || data.length() > 16000000 || !name.matches("BarkoLink-[A-Za-z0-9_-]+\\.pdf")) {
            call.reject("A valid PDF ticket is required.");
            return;
        }
        if (!saving.compareAndSet(false, true)) {
            call.reject("Finish the current ticket save before starting another.");
            return;
        }
        getActivity().runOnUiThread(() -> {
            try {
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/pdf");
                intent.putExtra(Intent.EXTRA_TITLE, name);
                startActivityForResult(call, intent, "saveResult");
            } catch (Exception error) {
                saving.set(false);
                call.reject("Could not open Android's Save dialog. Try Print/PDF instead.");
            }
        });
    }

    @ActivityCallback
    private void saveResult(PluginCall call, ActivityResult result) {
        if (call == null) { saving.set(false); return; }
        if (result.getResultCode() != Activity.RESULT_OK) {
            saving.set(false);
            JSObject response = new JSObject();
            response.put("cancelled", true);
            call.resolve(response);
            return;
        }
        Uri uri = result.getData() == null ? null : result.getData().getData();
        if (uri == null) {
            saving.set(false);
            call.reject("No save location was returned. Choose a folder and try again.");
            return;
        }
        getBridge().execute(() -> {
            try {
                byte[] pdf = Base64.decode(call.getString("data", ""), Base64.DEFAULT);
                if (pdf.length < 5 || pdf[0] != '%' || pdf[1] != 'P' || pdf[2] != 'D' || pdf[3] != 'F' || pdf[4] != '-')
                    throw new IllegalArgumentException("Invalid PDF");
                try (OutputStream output = getContext().getContentResolver().openOutputStream(uri, "w")) {
                    if (output == null) throw new IllegalStateException("No output stream");
                    output.write(pdf);
                    output.flush();
                }
                JSObject response = new JSObject();
                response.put("saved", true);
                call.resolve(response);
            } catch (Exception error) {
                call.reject("The PDF ticket could not be saved. Check free space or choose another folder.");
            } finally {
                saving.set(false);
            }
        });
    }
}
