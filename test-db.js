const mongoose = require('mongoose');
const uri = "mongodb+srv://adeel_db_user:Z8jNQ2cnWAdAmUFI@cluster0.kvjvx8x.mongodb.net/devco?retryWrites=true&w=majority";
mongoose.connect(uri).then(async () => {
    const db = mongoose.connection.useDb('devco');
    const Estimate = db.collection('estimatesdb');
    const est = await Estimate.findOne({ estimate: '26-0336' });
    console.log("26-0336:", { subTotal: est.subTotal, grandTotal: est.grandTotal, margin: est.margin, bidMarkUp: est.bidMarkUp });
    
    const est2 = await Estimate.findOne({ estimate: '26-0332' });
    console.log("26-0332:", { subTotal: est2.subTotal, grandTotal: est2.grandTotal, margin: est2.margin, bidMarkUp: est2.bidMarkUp });
    
    const est3 = await Estimate.findOne({ estimate: '26-0327' });
    console.log("26-0327:", { subTotal: est3.subTotal, grandTotal: est3.grandTotal, margin: est3.margin, bidMarkUp: est3.bidMarkUp });

    process.exit(0);
});
