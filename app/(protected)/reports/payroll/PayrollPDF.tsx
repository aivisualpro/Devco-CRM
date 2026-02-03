import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font } from '@react-pdf/renderer';

// Create styles
const styles = StyleSheet.create({
  page: {
    padding: 30,
    backgroundColor: '#ffffff',
    fontFamily: 'Helvetica',
  },
  header: {
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: 'bold',
  },
  summaryTable: {
    border: '1pt solid black',
    marginBottom: 10,
    width: '100%',
  },
  summaryRow: {
    flexDirection: 'row',
    borderBottom: '1pt solid black',
  },
  summaryRowLast: {
    flexDirection: 'row',
    borderBottom: 0,
  },
  summaryCol: {
    flex: 1,
    padding: 5,
    borderRight: '1pt solid black',
    textAlign: 'center',
    justifyContent: 'center',
  },
  summaryColLast: {
    flex: 1,
    padding: 5,
    borderRight: 0,
    textAlign: 'center',
    justifyContent: 'center',
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 10,
  },
  employeeHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    backgroundColor: '#eeeeee',
    padding: 5,
    marginTop: 15,
    marginBottom: 5,
    borderBottom: '1pt solid black',
  },
  table: {
    display: 'flex',
    width: 'auto',
    borderStyle: 'solid',
    borderColor: '#000',
    borderWidth: 1,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  tableRow: {
    flexDirection: 'row',
  },
  tableColHeader: {
    width: '11.11%', // 9 columns
    borderStyle: 'solid',
    borderColor: '#000',
    borderBottomWidth: 1,
    borderRightWidth: 1,
    backgroundColor: '#f6f6f6',
    padding: 4,
  },
  tableCol: {
    width: '11.11%',
    borderStyle: 'solid',
    borderColor: '#000',
    borderBottomWidth: 1,
    borderRightWidth: 1,
    padding: 4,
  },
  tableColFirst: {
    width: '11.11%',
    borderStyle: 'solid',
    borderColor: '#000',
    borderBottomWidth: 1,
    borderRightWidth: 1,
    backgroundColor: '#f6f6f6',
    padding: 4,
    fontWeight: 'bold',
  },
  tableCellHeader: {
    fontSize: 8,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  tableCell: {
    fontSize: 8,
    textAlign: 'center',
  },
  tableCellFirst: {
    fontSize: 8,
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    fontSize: 8,
    textAlign: 'center',
    color: 'grey',
  },
});

interface PayrollPDFProps {
  data: any[];
  weekRange: string;
  startDate: string;
  endDate: string;
  totalAmount: number;
  weekNumber: number;
  customerName?: string;
  proposal?: string;
  projectName?: string;
  projectId?: string;
}

export const PayrollPDF = ({ 
  data, 
  weekRange, 
  startDate, 
  endDate, 
  totalAmount, 
  weekNumber,
  customerName,
  proposal,
  projectName,
  projectId
}: PayrollPDFProps) => {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>Certified Payroll Report</Text>

        <View style={styles.summaryTable}>
          {/* Row 1: Week and Total Amount */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryCol}>
              <Text style={styles.summaryLabel}>Week: {new Date().getFullYear()}-{weekNumber}</Text>
              <Text style={styles.summaryValue}>From: {startDate} To: {endDate}</Text>
            </View>
            <View style={styles.summaryColLast}>
              <Text style={styles.summaryLabel}>Total Amount:</Text>
              <Text style={styles.summaryValue}>${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            </View>
          </View>
          
          {/* Row 2: Customer, Proposal, Project Name, Project ID */}
          <View style={styles.summaryRowLast}>
            <View style={styles.summaryCol}>
              <Text style={styles.summaryLabel}>Customer:</Text>
              <Text style={styles.summaryValue}>{customerName || '--'}</Text>
            </View>
            <View style={styles.summaryCol}>
              <Text style={styles.summaryLabel}>Proposal #:</Text>
              <Text style={styles.summaryValue}>{proposal || '--'}</Text>
            </View>
            <View style={styles.summaryCol}>
              <Text style={styles.summaryLabel}>Project Name:</Text>
              <Text style={styles.summaryValue}>{projectName || '--'}</Text>
            </View>
            <View style={styles.summaryColLast}>
              <Text style={styles.summaryLabel}>Project ID:</Text>
              <Text style={styles.summaryValue}>{projectId || '--'}</Text>
            </View>
          </View>
        </View>

        {data.map((emp, index) => (
          <View key={index} wrap={false} style={{ marginBottom: 20 }}>
            <Text style={styles.employeeHeader}>
              Name: {emp.name} | Address: {emp.address} | SSN#: ***-**-6020
            </Text>
            
            <View style={styles.table}>
              {/* Table Header */}
              <View style={styles.tableRow}>
                <View style={styles.tableColFirst}>
                  <Text style={styles.tableCellHeader}>Description</Text>
                </View>
                {days.map((day, i) => (
                  <View key={i} style={styles.tableColHeader}>
                    <Text style={styles.tableCellHeader}>{day}</Text>
                  </View>
                ))}
                <View style={styles.tableColHeader}>
                  <Text style={styles.tableCellHeader}>Total Hours</Text>
                </View>
              </View>

              {/* Project Row */}
              <View style={styles.tableRow}>
                <View style={styles.tableColFirst}>
                  <Text style={styles.tableCellFirst}>Project</Text>
                </View>
                {emp.days.map((d: any, i: number) => (
                  <View key={i} style={styles.tableCol}>
                    <Text style={[styles.tableCell, { fontSize: 6 }]}>
                      {d.estimates.length > 0 ? d.estimates.join(', ') : ''}
                    </Text>
                  </View>
                ))}
                <View style={styles.tableCol}></View>
              </View>

              {/* Certified Row */}
              <View style={styles.tableRow}>
                <View style={styles.tableColFirst}>
                  <Text style={styles.tableCellFirst}>Certified</Text>
                </View>
                {emp.days.map((d: any, i: number) => {
                  const hasProject = d.estimates.length > 0 || d.projectNames.length > 0;
                  return (
                    <View key={i} style={styles.tableCol}>
                      <Text style={[styles.tableCell, { color: hasProject ? (d.certified ? '#00CC00' : '#FF0000') : '#999999' }]}>
                        {hasProject ? (d.certified ? 'YES' : 'NO') : '--'}
                      </Text>
                    </View>
                  );
                })}
                <View style={styles.tableCol}></View>
              </View>

              {/* REG Row */}
              <View style={styles.tableRow}>
                <View style={styles.tableColFirst}>
                  <Text style={styles.tableCellFirst}>REG hrs</Text>
                </View>
                {emp.days.map((d: any, i: number) => (
                  <View key={i} style={styles.tableCol}>
                    <Text style={styles.tableCell}>{d.reg > 0 ? d.reg.toFixed(2) : '0.00'}</Text>
                  </View>
                ))}
                <View style={styles.tableCol}>
                  <Text style={styles.tableCell}>{emp.totalReg.toFixed(2)}</Text>
                </View>
              </View>

              {/* OT Row */}
              <View style={styles.tableRow}>
                <View style={styles.tableColFirst}>
                  <Text style={styles.tableCellFirst}>OT hrs</Text>
                </View>
                {emp.days.map((d: any, i: number) => (
                  <View key={i} style={styles.tableCol}>
                    <Text style={styles.tableCell}>{d.ot > 0 ? d.ot.toFixed(2) : '0.00'}</Text>
                  </View>
                ))}
                <View style={styles.tableCol}>
                  <Text style={styles.tableCell}>{emp.totalOt.toFixed(2)}</Text>
                </View>
              </View>

              {/* DT Row */}
              <View style={styles.tableRow}>
                <View style={styles.tableColFirst}>
                  <Text style={styles.tableCellFirst}>DT hrs</Text>
                </View>
                {emp.days.map((d: any, i: number) => (
                  <View key={i} style={styles.tableCol}>
                    <Text style={styles.tableCell}>{d.dt > 0 ? d.dt.toFixed(2) : '0.00'}</Text>
                  </View>
                ))}
                <View style={styles.tableCol}>
                  <Text style={styles.tableCell}>{emp.totalDt.toFixed(2)}</Text>
                </View>
              </View>

              {/* Diem Row */}
              <View style={styles.tableRow}>
                <View style={styles.tableColFirst}>
                  <Text style={styles.tableCellFirst}>Diem</Text>
                </View>
                {emp.days.map((d: any, i: number) => (
                  <View key={i} style={styles.tableCol}>
                    <Text style={styles.tableCell}>{d.diem > 0 ? d.diem.toFixed(2) : '0.00'}</Text>
                  </View>
                ))}
                <View style={styles.tableCol}>
                  <Text style={styles.tableCell}>{emp.totalDiem.toFixed(2)}</Text>
                </View>
              </View>

              {/* Total Row */}
              <View style={styles.tableRow}>
                <View style={[styles.tableColFirst, { backgroundColor: '#eeeeee' }]}>
                  <Text style={styles.tableCellFirst}>Total</Text>
                </View>
                {emp.days.map((d: any, i: number) => (
                  <View key={i} style={[styles.tableCol, { backgroundColor: '#eeeeee' }]}>
                    <Text style={styles.tableCell}>{d.total > 0 ? d.total.toFixed(2) : '0.00'}</Text>
                  </View>
                ))}
                <View style={[styles.tableCol, { backgroundColor: '#eeeeee' }]}>
                  <Text style={styles.tableCell}>{emp.totalHrs.toFixed(2)}</Text>
                </View>
              </View>
            </View>
          </View>
        ))}

        <Text style={styles.footer} render={({ pageNumber, totalPages }) => (
          `Page ${pageNumber} of ${totalPages} | Generated on ${new Date().toLocaleDateString()}`
        )} fixed />
      </Page>
    </Document>
  );
};
